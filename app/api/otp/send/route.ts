import { NextRequest, NextResponse } from "next/server";
import { ensure, hasDb } from "@/lib/db";

declare global {
  // eslint-disable-next-line no-var
  var confiOtpStore: Map<
    string,
    { code: string; expiresAt: number; attempts: number; lastSent: number }
  >;
}

if (!global.confiOtpStore) {
  global.confiOtpStore = new Map();
}

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const normalized = phone.replace(/\s/g, "").replace(/[^\d+]/g, "");
    if (normalized.length < 7) {
      return NextResponse.json({ error: "Phone number too short" }, { status: 400 });
    }

    // Rate limit: 1 OTP per 60 seconds
    const existing = global.confiOtpStore.get(normalized);
    if (existing && Date.now() - existing.lastSent < 60000) {
      const waitSec = Math.ceil(
        (60000 - (Date.now() - existing.lastSent)) / 1000
      );
      return NextResponse.json(
        {
          error: `Please wait ${waitSec} seconds before requesting another OTP`,
        },
        { status: 429 }
      );
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    global.confiOtpStore.set(normalized, {
      code,
      expiresAt,
      attempts: 0,
      lastSent: Date.now(),
    });

    // In production this would call an SMS gateway (Twilio, etc.)
    // For demo, log to server console
    console.log(
      `[CONFI OTP] Phone: ${normalized} | Code: ${code} | Expires: ${new Date(expiresAt).toISOString()}`
    );

    if (hasDb()) {
      await ensure();
    }

    return NextResponse.json({
      ok: true,
      message: "OTP sent",
      ...(process.env.NODE_ENV === "development" ? { devCode: code } : {}),
    });
  } catch (err) {
    console.error("OTP send error:", err);
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}