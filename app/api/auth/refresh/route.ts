import { NextRequest, NextResponse } from "next/server";
import { q, P } from "@/lib/db";
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
} from "@/lib/auth-utils";

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();

    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token" }, { status: 401 });
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired refresh token" },
        { status: 401 }
      );
    }

    // Verify token matches what's stored (rotation check)
    const rows = await q(
      `SELECT id, email, display_name, legal_name_verified, refresh_token FROM ${P}users WHERE id = $1`,
      [payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = rows[0] as {
      id: number;
      email: string;
      display_name: string | null;
      legal_name_verified: boolean;
      refresh_token: string;
    };

    if (user.refresh_token !== refreshToken) {
      // Token reuse detected — invalidate all sessions
      await q(`UPDATE ${P}users SET refresh_token = NULL WHERE id = $1`, [user.id]);
      return NextResponse.json(
        { error: "Token reuse detected. Please login again." },
        { status: 401 }
      );
    }

    const newAccessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      displayName: user.display_name ?? undefined,
      legalNameVerified: user.legal_name_verified,
    });
    const newRefreshToken = signRefreshToken({
      userId: user.id,
      email: user.email,
    });

    await q(
      `UPDATE ${P}users SET refresh_token = $1, updated_at = NOW() WHERE id = $2`,
      [newRefreshToken, user.id]
    );

    return NextResponse.json({
      ok: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("Refresh error:", err);
    return NextResponse.json({ error: "Token refresh failed" }, { status: 500 });
  }
}