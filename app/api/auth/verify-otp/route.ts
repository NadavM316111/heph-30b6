import { NextRequest, NextResponse } from "next/server";
import { q, P } from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/auth-utils";

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: "Email and OTP required" },
        { status: 400 }
      );
    }

    const rows = await q(
      `SELECT id, otp_code, otp_expires_at, email_verified FROM ${P}users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const user = rows[0] as {
      id: number;
      otp_code: string;
      otp_expires_at: string;
      email_verified: boolean;
    };

    if (user.otp_code !== otp) {
      return NextResponse.json({ error: "Invalid OTP code" }, { status: 400 });
    }

    if (new Date() > new Date(user.otp_expires_at)) {
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const accessToken = signAccessToken({ userId: user.id, email: email.toLowerCase() });
    const refreshToken = signRefreshToken({ userId: user.id, email: email.toLowerCase() });

    await q(
      `UPDATE ${P}users SET email_verified = TRUE, otp_code = NULL, otp_expires_at = NULL, refresh_token = $1, updated_at = NOW() WHERE id = $2`,
      [refreshToken, user.id]
    );

    return NextResponse.json({
      ok: true,
      accessToken,
      refreshToken,
      userId: user.id,
      needsProfile: true,
    });
  } catch (err) {
    console.error("OTP verify error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}