import { NextRequest, NextResponse } from "next/server";
import { q, P, ensure } from "@/lib/db";
import { generateOtp, hashToken } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  try {
    await ensure();
    const { phone } = await req.json();
    if (!phone || typeof phone !== "string" || phone.length < 8) {
      return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
    }

    // Rate limit: max 3 OTPs per phone per 10 minutes
    const recent = await q(
      `SELECT COUNT(*) as cnt FROM ${P}otp_codes
       WHERE phone = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
      [phone]
    );
    const cnt = Number((recent[0] as { cnt: string }).cnt);
    if (cnt >= 3) {
      return NextResponse.json({ error: "Too many OTP requests. Try again in 10 minutes." }, { status: 429 });
    }

    const otp = generateOtp();
    const hash = hashToken(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    await q(
      `INSERT INTO ${P}otp_codes (phone, code_hash, expires_at) VALUES ($1, $2, $3)`,
      [phone, hash, expiresAt.toISOString()]
    );

    // In production: send via Twilio/Vonage/etc.
    // Here: return devOtp for demo (remove in prod)
    console.log(`[CONFI OTP] ${phone} → ${otp}`);

    return NextResponse.json({ ok: true, devOtp: otp });
  } catch (err) {
    console.error("[otp/send]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}