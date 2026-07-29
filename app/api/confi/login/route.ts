import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { generateToken } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { phone, passwordHash } = body;

    if (!phone || !passwordHash) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const result = await q(
      `SELECT user_id, phone, email, display_name, legal_name, avatar_seed,
              password_hash, kyc_confirmed, verified, created_at
       FROM confi_users WHERE phone = $1`,
      [phone]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const user = result.rows[0];

    if (user.password_hash !== passwordHash) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    const token = generateToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await q(
      `INSERT INTO confi_sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
      [token, user.user_id, expires.toISOString()]
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash: _ph, ...safeUser } = user;

    return NextResponse.json({ ok: true, token, user: safeUser });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}