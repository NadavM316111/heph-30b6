import { NextRequest, NextResponse } from "next/server";
import { q, hasDb } from "@/lib/db";
import { isOTPExpired } from "@/lib/otp";
import { encryptPII, hashPhone } from "@/lib/crypto";
import { createToken, createRefreshToken } from "@/lib/jwt";

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

  const body = await req.json() as {
    otp: string;
    identifier: string;
    type: "phone" | "email";
  };

  const { otp, identifier, type } = body;

  if (!otp || !identifier || !type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    // Find valid OTP
    const otpRows = await q(`
      SELECT id, otp_hash, expires_at, attempts, used
      FROM ${P}_otps
      WHERE identifier = $1 AND identifier_type = $2 AND used = FALSE
      ORDER BY created_at DESC
      LIMIT 1
    `, [identifier, type]);

    if (otpRows.length === 0) {
      return NextResponse.json({ error: "No pending OTP found. Please request a new one." }, { status: 400 });
    }

    const otpRecord = otpRows[0] as {
      id: string;
      otp_hash: string;
      expires_at: string;
      attempts: number;
      used: boolean;
    };

    // Check attempts
    if (otpRecord.attempts >= 5) {
      await q(`UPDATE ${P}_otps SET used = TRUE WHERE id = $1`, [otpRecord.id]);
      return NextResponse.json({ error: "Too many failed attempts. Please request a new OTP." }, { status: 429 });
    }

    // Check expiry
    if (isOTPExpired(Number(otpRecord.expires_at))) {
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 });
    }

    // Verify OTP
    const expectedHash = simpleHash(otp + identifier);
    if (expectedHash !== otpRecord.otp_hash) {
      await q(`UPDATE ${P}_otps SET attempts = attempts + 1 WHERE id = $1`, [otpRecord.id]);
      const remaining = 4 - otpRecord.attempts;
      return NextResponse.json({ error: `Incorrect OTP. ${remaining} attempt(s) remaining.` }, { status: 400 });
    }

    // Mark OTP used
    await q(`UPDATE ${P}_otps SET used = TRUE WHERE id = $1`, [otpRecord.id]);

    // Find or create user
    let userId: string;
    let profileComplete = false;
    let displayName: string | undefined;
    let avatarUrl: string | undefined;

    if (type === "phone") {
      const ph = hashPhone(identifier);
      const rows = await q(`
        SELECT id, profile_complete, display_name, avatar_url FROM ${P}_users WHERE phone_hash = $1
      `, [ph]);

      if (rows.length > 0) {
        const u = rows[0] as { id: string; profile_complete: boolean; display_name: string; avatar_url: string };
        userId = u.id;
        profileComplete = u.profile_complete;
        displayName = u.display_name;
        avatarUrl = u.avatar_url;
      } else {
        userId = generateId();
        const encPhone = encryptPII(identifier);
        await q(`
          INSERT INTO ${P}_users (id, phone_hash, phone_encrypted, profile_complete)
          VALUES ($1, $2, $3, FALSE)
        `, [userId, ph, encPhone]);
      }
    } else {
      const eh = simpleHash(identifier);
      const rows = await q(`
        SELECT id, profile_complete, display_name, avatar_url FROM ${P}_users WHERE email_hash = $1
      `, [eh]);

      if (rows.length > 0) {
        const u = rows[0] as { id: string; profile_complete: boolean; display_name: string; avatar_url: string };
        userId = u.id;
        profileComplete = u.profile_complete;
        displayName = u.display_name;
        avatarUrl = u.avatar_url;
      } else {
        userId = generateId();
        const encEmail = encryptPII(identifier);
        await q(`
          INSERT INTO ${P}_users (id, email_encrypted, email_hash, profile_complete)
          VALUES ($1, $2, $3, FALSE)
        `, [userId, encEmail, eh]);
      }
    }

    // Create tokens
    const tokenPayload = {
      userId,
      profileComplete,
      displayName,
      avatarUrl,
      ...(type === "phone" ? { phone: identifier } : { email: identifier }),
    };

    const accessToken = createToken(tokenPayload);
    const refreshToken = createRefreshToken(userId);

    // Store session
    const sessionId = generateId();
    const sessionExpiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
    await q(`
      INSERT INTO ${P}_sessions (id, user_id, refresh_token, expires_at)
      VALUES ($1, $2, $3, $4)
    `, [sessionId, userId, refreshToken, sessionExpiry]);

    return NextResponse.json({
      ok: true,
      accessToken,
      refreshToken,
      sessionId,
      userId,
      profileComplete,
      displayName,
      avatarUrl,
      isNewUser: !profileComplete,
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}