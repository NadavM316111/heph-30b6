import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

const otpStore = new Map<
  string,
  { code: string; expiresAt: number; attempts: number; lastSent: number }
>();

// Shared reference to the module-level map from send route
// Since Next.js routes are separate modules, we use a global approach
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
    const { phone, otp } = await req.json();

    if (!phone || !otp) {
      return NextResponse.json({ error: "Missing phone or OTP" }, { status: 400 });
    }

    const normalized = phone.replace(/\s/g, "").replace(/[^\d+]/g, "");
    const record = global.confiOtpStore.get(normalized);

    if (!record) {
      return NextResponse.json(
        { error: "No OTP sent to this number. Request a new code." },
        { status: 400 }
      );
    }

    // Check expiry
    if (Date.now() > record.expiresAt) {
      global.confiOtpStore.delete(normalized);
      return NextResponse.json({ error: "OTP expired. Request a new code." }, { status: 400 });
    }

    // Rate limit attempts
    if (record.attempts >= 5) {
      return NextResponse.json(
        { error: "Too many failed attempts. Request a new OTP." },
        { status: 429 }
      );
    }

    if (record.code !== otp.trim()) {
      record.attempts += 1;
      global.confiOtpStore.set(normalized, record);
      return NextResponse.json(
        {
          error: `Invalid OTP. ${5 - record.attempts} attempts remaining.`,
        },
        { status: 400 }
      );
    }

    // Valid OTP — clear it
    global.confiOtpStore.delete(normalized);

    const phoneEmail = `phone_${normalized.replace("+", "")}@confi.app`;

    // Check if user exists in DB
    if (hasDb()) {
      await ensure();
      try {
        const existing = await q(
          `SELECT id, email, display_name, avatar_color, kyc_verified 
           FROM confi_users WHERE phone = $1 LIMIT 1`,
          [normalized]
        );
        const rows = existing as Array<{
          id: number;
          email: string;
          display_name: string;
          avatar_color: string;
          kyc_verified: boolean;
        }>;

        if (rows.length > 0) {
          const user = rows[0];
          const token = Buffer.from(
            `${user.email}:${Date.now()}:verified`
          ).toString("base64");
          return NextResponse.json({
            ok: true,
            newUser: false,
            email: user.email,
            token,
            userId: user.id,
            displayName: user.display_name,
            avatarColor: user.avatar_color,
            kycVerified: user.kyc_verified,
          });
        }
      } catch (dbErr) {
        console.error("DB lookup error:", dbErr);
      }
    }

    // New user
    const tempToken = Buffer.from(
      `${phoneEmail}:${Date.now()}:new`
    ).toString("base64");

    return NextResponse.json({
      ok: true,
      newUser: true,
      email: phoneEmail,
      tempToken,
    });
  } catch (err) {
    console.error("OTP verify error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}