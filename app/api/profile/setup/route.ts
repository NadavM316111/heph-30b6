import { NextRequest, NextResponse } from "next/server";
import { q, P } from "@/lib/db";
import { verifyAccessToken, signAccessToken, signRefreshToken } from "@/lib/auth-utils";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const { displayName, avatar } = await req.json();

    if (!displayName || displayName.trim().length < 2) {
      return NextResponse.json(
        { error: "Display name must be at least 2 characters" },
        { status: 400 }
      );
    }

    await q(
      `UPDATE ${P}users SET display_name = $1, avatar = $2, updated_at = NOW() WHERE id = $3`,
      [displayName.trim(), avatar ?? "avatar1", payload.userId]
    );

    // Issue fresh tokens with updated profile info
    const newAccessToken = signAccessToken({
      userId: payload.userId,
      email: payload.email,
      displayName: displayName.trim(),
      legalNameVerified: payload.legalNameVerified,
    });
    const newRefreshToken = signRefreshToken({
      userId: payload.userId,
      email: payload.email,
    });

    await q(
      `UPDATE ${P}users SET refresh_token = $1 WHERE id = $2`,
      [newRefreshToken, payload.userId]
    );

    return NextResponse.json({
      ok: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        displayName: displayName.trim(),
        avatar: avatar ?? "avatar1",
      },
    });
  } catch (err) {
    console.error("Profile setup error:", err);
    return NextResponse.json({ error: "Profile setup failed" }, { status: 500 });
  }
}