import { NextRequest, NextResponse } from "next/server";
import { q, hasDb } from "@/lib/db";
import { generateOTP, otpExpiresAt, sendOTPviaSMS, sendOTPviaEmail } from "@/lib/otp";
import { encryptPII, hashPhone } from "@/lib/crypto";

const P = process.env.APP_TABLE_PREFIX ?? "confi";

function simpleHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export async function POST(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json({ error: "No database configured" }, { status: 503 });
  }

  const body = await req.json() as { phone?: string; email?: string; type: "phone" | "email" };
  const { phone, email, type } = body;

  if (type === "phone" && !phone) {
    return NextResponse.json({ error: "Phone number required" }, { status: 400 });
  }
  if (type === "email" && !email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const identifier = type === "phone" ? phone! : email!;
  const otp = generateOTP();
  const expiresAt = otpExpiresAt();
  const otpHash = simpleHash(otp + identifier);
  const otpId = generateId();

  try {
    // Invalidate old OTPs for this identifier
    await q(`
      UPDATE ${P}_otps SET used = TRUE
      WHERE identifier = $1 AND used = FALSE
    `, [identifier]);

    // Store new OTP
    await q(`
      INSERT INTO ${P}_otps (id, identifier, identifier_type, otp_hash, expires_at, used, attempts)
      VALUES ($1, $2, $3, $4, $5, FALSE, 0)
    `, [otpId, identifier, type, otpHash, expiresAt]);

    let result;
    if (type === "phone") {
      result = await sendOTPviaSMS(phone!, otp);
    } else {
      result = await sendOTPviaEmail(email!, otp);
    }

    // Check if user exists
    let userExists = false;
    if (type === "phone") {
      const ph = hashPhone(phone!);
      const rows = await q(`SELECT id FROM ${P}_users WHERE phone_hash = $1`, [ph]);
      userExists = rows.length > 0;
    } else {
      const eh = simpleHash(email!);
      const rows = await q(`SELECT id FROM ${P}_users WHERE email_hash = $1`, [eh]);
      userExists = rows.length > 0;
    }

    return NextResponse.json({
      ok: true,
      message: result.message,
      isNewUser: !userExists,
      otpId,
      // DEV ONLY — remove in production
      devOtp: result.devOtp,
    });
  } catch (err) {
    console.error("Send OTP error:", err);
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}