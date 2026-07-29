import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

// Ensure the users table exists
async function ensureUsersTable() {
  await ensure(`
    CREATE TABLE IF NOT EXISTS confi_users (
      id            SERIAL PRIMARY KEY,
      user_uid      TEXT UNIQUE NOT NULL,
      crypto_id     TEXT UNIQUE NOT NULL,
      phone         TEXT UNIQUE NOT NULL,
      display_name  TEXT NOT NULL,
      email         TEXT,
      avatar_seed   TEXT DEFAULT 'default',
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function POST(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    await ensureUsersTable();
    const body = await req.json();
    const { userUid, cryptoId, phone, displayName, email, avatarSeed } = body;

    if (!userUid || !cryptoId || !phone || !displayName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Upsert user
    const result = await q(
      `INSERT INTO confi_users (user_uid, crypto_id, phone, display_name, email, avatar_seed)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (phone) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         email = EXCLUDED.email,
         avatar_seed = EXCLUDED.avatar_seed,
         updated_at = NOW()
       RETURNING id, user_uid, crypto_id, phone, display_name, email, avatar_seed, created_at`,
      [userUid, cryptoId, phone, displayName, email || null, avatarSeed || "default"]
    );

    return NextResponse.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    await ensureUsersTable();
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");
    const uid = searchParams.get("uid");

    if (phone) {
      const result = await q(
        `SELECT id, user_uid, crypto_id, phone, display_name, email, avatar_seed, created_at
         FROM confi_users WHERE phone = $1`,
        [phone]
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, user: result.rows[0] });
    }

    if (uid) {
      const result = await q(
        `SELECT id, user_uid, crypto_id, phone, display_name, email, avatar_seed, created_at
         FROM confi_users WHERE user_uid = $1`,
        [uid]
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, user: result.rows[0] });
    }

    return NextResponse.json(
      { error: "Provide phone or uid query param" },
      { status: 400 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    await ensureUsersTable();
    const body = await req.json();
    const { userUid, displayName, avatarSeed, email } = body;

    if (!userUid) {
      return NextResponse.json({ error: "userUid required" }, { status: 400 });
    }

    const result = await q(
      `UPDATE confi_users
       SET display_name = COALESCE($2, display_name),
           avatar_seed  = COALESCE($3, avatar_seed),
           email        = COALESCE($4, email),
           updated_at   = NOW()
       WHERE user_uid = $1
       RETURNING id, user_uid, crypto_id, phone, display_name, email, avatar_seed`,
      [userUid, displayName || null, avatarSeed || null, email || null]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}