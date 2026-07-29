import { NextRequest, NextResponse } from "next/server";
import { q, P } from "@/lib/db";
import { generateOTP } from "@/lib/auth-utils";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const rows = await q(
      `SELECT id, email_verified FROM ${P}users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const user = rows[0] as { id: number; email_verified: boolean };

    if (user.email_verified) {
      return NextResponse.json(
        { error: "Email already verified" },
        { status: 400 }
      );
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await q(
      `UPDATE ${P}users SET otp_code = $1, otp_expires_at = $2, updated_at = NOW() WHERE id = $3`,
      [otp, otpExpires.toISOString(), user.id]
    );

    console.log(`[CONFI OTP RESEND] ${email}: ${otp}`);

    return NextResponse.json({
      ok: true,
      message: "New OTP sent",
      _devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });
  } catch (err) {
    console.error("Resend OTP error:", err);
    return NextResponse.json({ error: "Failed to resend OTP" }, { status: 500 });
  }
}