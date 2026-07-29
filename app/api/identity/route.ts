import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

// Ensure the identity table exists
async function ensureTable() {
  await ensure(`
    CREATE TABLE IF NOT EXISTS confi_verified_identities (
      id            SERIAL PRIMARY KEY,
      identity_id   TEXT NOT NULL UNIQUE,
      email         TEXT NOT NULL UNIQUE,
      display_name  TEXT,
      phone         TEXT,
      avatar        TEXT,
      email_verified BOOLEAN DEFAULT FALSE,
      phone_verified BOOLEAN DEFAULT FALSE,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function POST(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json({ ok: true, mock: true });
  }
  try {
    await ensureTable();
    const body = await req.json();
    const {
      identityId, email, displayName, phone, avatar,
      emailVerified, phoneVerified,
    } = body as {
      identityId: string;
      email: string;
      displayName: string;
      phone?: string;
      avatar?: string;
      emailVerified?: boolean;
      phoneVerified?: boolean;
    };

    if (!identityId || !email) {
      return NextResponse.json({ error: "identityId and email required" }, { status: 400 });
    }

    await q(
      `INSERT INTO confi_verified_identities
         (identity_id, email, display_name, phone, avatar, email_verified, phone_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO UPDATE SET
         display_name   = EXCLUDED.display_name,
         phone          = EXCLUDED.phone,
         avatar         = EXCLUDED.avatar,
         email_verified = EXCLUDED.email_verified,
         phone_verified = EXCLUDED.phone_verified,
         updated_at     = NOW()`,
      [identityId, email, displayName, phone ?? null, avatar ?? null,
       emailVerified ?? false, phoneVerified ?? false]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("identity upsert error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json({ ok: true, mock: true, identities: [] });
  }
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "email param required" }, { status: 400 });
    }

    const rows = await q(
      `SELECT identity_id, email, display_name, phone, avatar,
              email_verified, phone_verified, created_at
       FROM confi_verified_identities
       WHERE email = $1`,
      [email]
    );

    if (!rows || (rows as unknown[]).length === 0) {
      return NextResponse.json({ found: false });
    }

    const row = (rows as Record<string, unknown>[])[0];
    return NextResponse.json({ found: true, identity: row });
  } catch (err) {
    console.error("identity fetch error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}