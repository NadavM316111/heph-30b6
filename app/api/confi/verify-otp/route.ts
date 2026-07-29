import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { phone, code } = body;

    if (!phone || !code) {
      return NextResponse.json({ error: "Phone and code required" }, { status: 400 });
    }

    const result = await q(
      `SELECT id, code, expires_at, used FROM confi_otp
       WHERE phone = $1 AND used = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "No active OTP found" }, { status: 400 });
    }

    const otp = result.rows[0];

    if (new Date(otp.expires_at) < new Date()) {
      return NextResponse.json({ error: "OTP expired" }, { status: 400 });
    }

    if (otp.code !== String(code)) {
      return NextResponse.json({ error: "Incorrect OTP" }, { status: 400 });
    }

    await q(`UPDATE confi_otp SET used = TRUE WHERE id = $1`, [otp.id]);

    return NextResponse.json({ ok: true, verified: true });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}