import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { generateUserId, generateToken } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { phone, email, displayName, legalName, passwordHash, avatarSeed } = body;

    if (!phone || !displayName || !legalName || !passwordHash || !avatarSeed) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check phone uniqueness
    const existing = await q(
      `SELECT id FROM confi_users WHERE phone = $1`,
      [phone]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: "Phone number already registered" }, { status: 409 });
    }

    if (email) {
      const emailCheck = await q(
        `SELECT id FROM confi_users WHERE email = $1`,
        [email]
      );
      if (emailCheck.rows.length > 0) {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }
    }

    const userId = generateUserId();

    await q(
      `INSERT INTO confi_users
         (user_id, phone, email, display_name, legal_name, avatar_seed, password_hash, kyc_confirmed, verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, TRUE)`,
      [userId, phone, email || null, displayName, legalName, avatarSeed, passwordHash]
    );

    // Create session
    const token = generateToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await q(
      `INSERT INTO confi_sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
      [token, userId, expires.toISOString()]
    );

    const userRow = await q(
      `SELECT user_id, phone, email, display_name, legal_name, avatar_seed, kyc_confirmed, verified, created_at
       FROM confi_users WHERE user_id = $1`,
      [userId]
    );

    return NextResponse.json({ ok: true, token, user: userRow.rows[0] });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}