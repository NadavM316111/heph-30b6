import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

async function initTable() {
  await ensure(`
    CREATE TABLE IF NOT EXISTS confi_users (
      id SERIAL PRIMARY KEY,
      confi_id TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      avatar TEXT,
      bio TEXT DEFAULT '',
      recovery_email TEXT,
      recovery_pin_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_seen TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function POST(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    await initTable();
    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { confiId, phone, email, displayName, avatar, bio } = body;
      if (!confiId || !phone || !email || !displayName) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      // Check existing
      const existing = await q("SELECT confi_id FROM confi_users WHERE phone = $1 OR email = $2", [phone, email]);
      if (existing.length > 0) {
        return NextResponse.json({ error: "User already exists", confiId: existing[0].confi_id }, { status: 409 });
      }

      await q(
        "INSERT INTO confi_users (confi_id, phone, email, display_name, avatar, bio) VALUES ($1, $2, $3, $4, $5, $6)",
        [confiId, phone, email, displayName, avatar ?? "", bio ?? ""]
      );

      return NextResponse.json({ ok: true, confiId });
    }

    if (action === "lookup") {
      const { phone } = body;
      if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });

      const rows = await q("SELECT * FROM confi_users WHERE phone = $1", [phone]);
      if (rows.length === 0) return NextResponse.json({ found: false });

      const u = rows[0];
      return NextResponse.json({
        found: true,
        user: {
          confiId: u.confi_id,
          phone: u.phone,
          email: u.email,
          displayName: u.display_name,
          avatar: u.avatar,
          bio: u.bio,
          createdAt: u.created_at,
        },
      });
    }

    if (action === "update") {
      const { confiId, displayName, bio, avatar } = body;
      if (!confiId) return NextResponse.json({ error: "Confi ID required" }, { status: 400 });

      await q(
        "UPDATE confi_users SET display_name = $1, bio = $2, avatar = $3, last_seen = NOW() WHERE confi_id = $4",
        [displayName, bio ?? "", avatar ?? "", confiId]
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "set-recovery") {
      const { confiId, recoveryEmail, recoveryPin } = body;
      if (!confiId) return NextResponse.json({ error: "Confi ID required" }, { status: 400 });

      await q(
        "UPDATE confi_users SET recovery_email = $1, recovery_pin_hash = $2 WHERE confi_id = $3",
        [recoveryEmail ?? null, recoveryPin ?? null, confiId]
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "recover") {
      const { recoveryEmail, recoveryPin } = body;
      if (!recoveryEmail) return NextResponse.json({ error: "Recovery email required" }, { status: 400 });

      const rows = await q(
        "SELECT * FROM confi_users WHERE recovery_email = $1 AND recovery_pin_hash = $2",
        [recoveryEmail, recoveryPin]
      );
      if (rows.length === 0) return NextResponse.json({ found: false });

      const u = rows[0];
      return NextResponse.json({
        found: true,
        user: {
          confiId: u.confi_id,
          phone: u.phone,
          email: u.email,
          displayName: u.display_name,
          avatar: u.avatar,
          bio: u.bio,
          createdAt: u.created_at,
        },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Users API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    await initTable();
    const { searchParams } = new URL(req.url);
    const confiId = searchParams.get("confiId");

    if (!confiId) return NextResponse.json({ error: "confiId required" }, { status: 400 });

    const rows = await q("SELECT * FROM confi_users WHERE confi_id = $1", [confiId]);
    if (rows.length === 0) return NextResponse.json({ found: false });

    const u = rows[0];
    return NextResponse.json({
      found: true,
      user: {
        confiId: u.confi_id,
        phone: u.phone,
        email: u.email,
        displayName: u.display_name,
        avatar: u.avatar,
        bio: u.bio,
        createdAt: u.created_at,
        lastSeen: u.last_seen,
      },
    });
  } catch (err) {
    console.error("Users GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}