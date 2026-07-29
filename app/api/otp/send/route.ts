import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

// Generate a random 6-digit OTP
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// A secret that makes the stored OTP usable as a password seed
function generateSecret(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone || typeof phone !== "string" || phone.length < 7) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const otp = generateOtp();
    const secret = generateSecret();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (hasDb()) {
      await ensure();
      // Upsert OTP record
      await q(
        `INSERT INTO confi_otp_codes (phone, code, secret, expires_at, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (phone) DO UPDATE
         SET code = $2, secret = $3, expires_at = $4, created_at = NOW()`,
        [phone, otp, secret, expiresAt.toISOString()]
      );
    } else {
      // No DB — store in-memory (dev only, single-instance)
      otpStore[phone] = { otp, secret, expiresAt };
    }

    // In production, integrate Twilio here:
    // await twilioClient.messages.create({ to: phone, from: TWILIO_FROM, body: `Your Confi code: ${otp}` });

    // For dev/demo: log to console and return in response
    console.log(`[Confi OTP] Phone: ${phone} | Code: ${otp} | Secret: ${secret}`);

    return NextResponse.json({
      ok: true,
      message: "OTP sent",
      // Return OTP in dev mode (remove in production)
      _dev_otp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });
  } catch (err: unknown) {
    console.error("[otp/send]", err);
    return NextResponse.json(
      { error: "Failed to send OTP" },
      { status: 500 }
    );
  }
}

// In-memory fallback (dev, single-instance only)
const otpStore: Record<string, { otp: string; secret: string; expiresAt: Date }> = {};