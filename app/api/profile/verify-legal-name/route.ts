import { NextRequest, NextResponse } from "next/server";
import { q, P } from "@/lib/db";
import { verifyAccessToken, signAccessToken } from "@/lib/auth-utils";

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

    const { legalFullName, confirmLegalFullName } = await req.json();

    if (!legalFullName || legalFullName.trim().length < 3) {
      return NextResponse.json(
        { error: "Legal full name must be at least 3 characters" },
        { status: 400 }
      );
    }

    if (legalFullName.trim() !== confirmLegalFullName?.trim()) {
      return NextResponse.json(
        { error: "Legal names do not match" },
        { status: 400 }
      );
    }

    // Must contain at least first and last name
    const nameParts = legalFullName.trim().split(/\s+/);
    if (nameParts.length < 2) {
      return NextResponse.json(
        { error: "Please enter your full legal name (first and last name at minimum)" },
        { status: 400 }
      );
    }

    // Check if already verified
    const rows = await q(
      `SELECT legal_name_verified FROM ${P}users WHERE id = $1`,
      [payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = rows[0] as { legal_name_verified: boolean };

    if (user.legal_name_verified) {
      return NextResponse.json(
        { error: "Legal name already verified and cannot be changed" },
        { status: 400 }
      );
    }

    await q(
      `UPDATE ${P}users SET legal_full_name = $1, legal_name_verified = TRUE, updated_at = NOW() WHERE id = $2`,
      [legalFullName.trim(), payload.userId]
    );

    // Issue new token with legalNameVerified flag
    const newAccessToken = signAccessToken({
      userId: payload.userId,
      email: payload.email,
      displayName: payload.displayName,
      legalNameVerified: true,
    });

    return NextResponse.json({
      ok: true,
      accessToken: newAccessToken,
      legalFullName: legalFullName.trim(),
      message:
        "Legal name verified and will be binding on all NDA agreements",
    });
  } catch (err) {
    console.error("Legal name verification error:", err);
    return NextResponse.json(
      { error: "Legal name verification failed" },
      { status: 500 }
    );
  }
}