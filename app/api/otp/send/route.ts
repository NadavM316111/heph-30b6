import { NextRequest, NextResponse } from "next/server";
import { q, hasDb } from "@/lib/db";

// In production this would call Twilio. Since TWILIO_AUTH_TOKEN is not in our
// allowed env vars, we generate a real OTP, store it in the DB, and surface
// it in dev mode so the UI can show it.  In a real Twilio deployment you swap
// the TODO block for a fetch() to api.twilio.com.

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    if (hasDb()) {
      await q(
        `CREATE TABLE IF NOT EXISTS confi_otp (
          id SERIAL PRIMARY KEY,
          phone TEXT NOT NULL,
          otp TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        []
      );
      // Invalidate previous OTPs for this phone
      await q(`UPDATE confi_otp SET used = TRUE WHERE phone = $1`, [phone]);
      await q(
        `INSERT INTO confi_otp (phone, otp, expires_at) VALUES ($1, $2, $3)`,
        [phone, otp, expiresAt.toISOString()]
      );
    }

    // TODO: Replace with Twilio SMS when TWILIO_AUTH_TOKEN is available:
    // await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
    //   method: "POST",
    //   headers: { Authorization: "Basic " + btoa(`${SID}:${AUTH_TOKEN}`) },
    //   body: new URLSearchParams({ To: phone, From: FROM, Body: `Your Confi OTP: ${otp}` }),
    // });

    console.log(`[CONFI OTP] Phone: ${phone}, OTP: ${otp}`);

    // In dev / no-Twilio mode, return the OTP in the response so the UI can display it.
    return NextResponse.json({ ok: true, devOtp: otp });
  } catch (err) {
    console.error("OTP send error:", err);
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}