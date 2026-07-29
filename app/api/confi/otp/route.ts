import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { generateOTP } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json({ error: "Phone required" }, { status: 400 });
    }

    // Invalidate old OTPs for this phone
    await q(`UPDATE confi_otp SET used = TRUE WHERE phone = $1`, [phone]);

    const code = generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await q(
      `INSERT INTO confi_otp (phone, code, expires_at) VALUES ($1, $2, $3)`,
      [phone, code, expires.toISOString()]
    );

    // In production this would send an SMS via Twilio etc.
    // Since no SMS API key is available, we return the code for demo purposes.
    return NextResponse.json({ ok: true, demoCode: code });
  } catch (err) {
    console.error("OTP error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}