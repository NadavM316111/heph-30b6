import { NextRequest, NextResponse } from "next/server";
import { q, hasDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { phone, otp } = await req.json();
    if (!phone || !otp) {
      return NextResponse.json({ error: "Phone and OTP required" }, { status: 400 });
    }

    if (!hasDb()) {
      // No DB: accept any 6-digit OTP in dev (the devOtp shown in UI)
      if (otp.length >= 4) return NextResponse.json({ ok: true });
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }

    const rows = await q(
      `SELECT id, otp, expires_at, used FROM confi_otp
       WHERE phone = $1 AND used = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "No OTP found. Request a new one." }, { status: 400 });
    }

    const record = rows[0];
    if (record.used) {
      return NextResponse.json({ error: "OTP already used" }, { status: 400 });
    }
    if (new Date(record.expires_at) < new Date()) {
      return NextResponse.json({ error: "OTP expired. Request a new one." }, { status: 400 });
    }
    if (record.otp !== String(otp)) {
      return NextResponse.json({ error: "Incorrect OTP" }, { status: 400 });
    }

    await q(`UPDATE confi_otp SET used = TRUE WHERE id = $1`, [record.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("OTP verify error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}