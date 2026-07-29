import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { q, P, ensure } from "@/lib/db";
import { generateOTP } from "@/lib/auth-utils";

export async function POST(req: NextRequest) {
  try {
    await ensure();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const existing = await q(`SELECT id FROM ${P}users WHERE email = $1`, [
      email.toLowerCase(),
    ]);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await q(
      `INSERT INTO ${P}users (email, password_hash, otp_code, otp_expires_at, email_verified)
       VALUES ($1, $2, $3, $4, FALSE)`,
      [email.toLowerCase(), passwordHash, otp, otpExpires.toISOString()]
    );

    // In production, send via nodemailer. For demo, return OTP in response.
    console.log(`[CONFI OTP] ${email}: ${otp}`);

    return NextResponse.json({
      ok: true,
      message: "OTP sent to your email",
      // REMOVE in production:
      _devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}