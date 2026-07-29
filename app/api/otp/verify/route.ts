import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

// Shared in-memory store reference (same module instance as send route in dev)
// In production, always use DB.
declare global {
  // eslint-disable-next-line no-var
  var _confiOtpStore: Record<string, { otp: string; secret: string; expiresAt: Date }> | undefined;
}

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return NextResponse.json({ error: "Phone and code are required" }, { status: 400 });
    }

    let storedOtp: string | null = null;
    let storedSecret: string | null = null;

    if (hasDb()) {
      await ensure();
      const rows = await q(
        `SELECT code, secret, expires_at FROM confi_otp_codes WHERE phone = $1`,
        [phone]
      );
      if (!rows || rows.length === 0) {
        return NextResponse.json({ error: "No OTP found for this number. Please request a new code." }, { status: 400 });
      }
      const row = rows[0];
      if (new Date(row.expires_at) < new Date()) {
        return NextResponse.json({ error: "Code expired. Please request a new one." }, { status: 400 });
      }
      storedOtp = row.code;
      storedSecret = row.secret;
    } else {
      // Dev fallback using global store
      if (!global._confiOtpStore) global._confiOtpStore = {};
      const entry = global._confiOtpStore[phone];
      if (!entry) {
        // Dev convenience: accept "123456" as universal test code
        if (code === "123456") {
          return NextResponse.json({ ok: true, secret: "dev_secret_123" });
        }
        return NextResponse.json({ error: "No OTP found. Request a new code." }, { status: 400 });
      }
      if (entry.expiresAt < new Date()) {
        return NextResponse.json({ error: "Code expired." }, { status: 400 });
      }
      storedOtp = entry.otp;
      storedSecret = entry.secret;
    }

    if (code !== storedOtp) {
      return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 });
    }

    // Clean up used OTP
    if (hasDb()) {
      await q(`DELETE FROM confi_otp_codes WHERE phone = $1`, [phone]);
    } else {
      if (global._confiOtpStore) delete global._confiOtpStore[phone];
    }

    return NextResponse.json({ ok: true, secret: storedSecret });
  } catch (err: unknown) {
    console.error("[otp/verify]", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}