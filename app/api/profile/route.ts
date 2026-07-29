import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserRow {
  phone: string;
  username: string;
  display_name: string;
  photo_data_url: string | null;
  created_at: string;
  email: string;
}

function rowToUser(row: UserRow) {
  return {
    phone: row.phone,
    username: row.username,
    displayName: row.display_name,
    photoDataUrl: row.photo_data_url || null,
    createdAt: row.created_at,
    email: row.email,
  };
}

// ─── Ensure tables ────────────────────────────────────────────────────────────
async function ensureTables() {
  if (!hasDb()) return;
  await ensure();

  await q(
    `CREATE TABLE IF NOT EXISTS confi_users (
      id SERIAL PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      photo_data_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    []
  );

  await q(
    `CREATE TABLE IF NOT EXISTS confi_otp_codes (
      phone TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      secret TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    []
  );
}

// ─── GET /api/profile?phone=xxx ───────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");

    if (!phone) {
      return NextResponse.json({ error: "Phone required" }, { status: 400 });
    }

    if (!hasDb()) {
      // Dev: check localStorage-equivalent via global store
      if (global._confiUserStore) {
        const u = global._confiUserStore[phone];
        if (u) return NextResponse.json({ user: u });
      }
      return NextResponse.json({ user: null });
    }

    await ensureTables();

    const rows = await q(
      `SELECT phone, email, username, display_name, photo_data_url, created_at FROM confi_users WHERE phone = $1`,
      [phone]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({ user: rowToUser(rows[0] as UserRow) });
  } catch (err: unknown) {
    console.error("[profile GET]", err);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

// ─── POST /api/profile — Create profile ───────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, username, displayName, photoDataUrl } = body;

    if (!phone || !username || !displayName) {
      return NextResponse.json({ error: "phone, username, displayName required" }, { status: 400 });
    }

    if (username.length < 3 || !/^[a-z0-9_]+$/.test(username)) {
      return NextResponse.json({ error: "Invalid username format" }, { status: 400 });
    }

    const digits = phone.replace(/\D/g, "");
    const email = `phone_${digits}@confi.internal`;

    if (!hasDb()) {
      // Dev fallback
      if (!global._confiUserStore) global._confiUserStore = {};
      if (Object.values(global._confiUserStore).some((u) => u.username === username && u.phone !== phone)) {
        return NextResponse.json({ error: "Username already taken" }, { status: 409 });
      }
      const user = {
        phone,
        email,
        username,
        displayName,
        photoDataUrl: photoDataUrl || null,
        createdAt: new Date().toISOString(),
      };
      global._confiUserStore[phone] = user;
      return NextResponse.json({ user });
    }

    await ensureTables();

    // Check username uniqueness
    const existing = await q(
      `SELECT id FROM confi_users WHERE username = $1 AND phone != $2`,
      [username, phone]
    );
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    const rows = await q(
      `INSERT INTO confi_users (phone, email, username, display_name, photo_data_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (phone) DO UPDATE
       SET username = $3, display_name = $4, photo_data_url = $5, updated_at = NOW()
       RETURNING phone, email, username, display_name, photo_data_url, created_at`,
      [phone, email, username, displayName, photoDataUrl || null]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    return NextResponse.json({ user: rowToUser(rows[0] as UserRow) });
  } catch (err: unknown) {
    console.error("[profile POST]", err);
    const msg = err instanceof Error ? err.message : "Profile creation failed";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "Username or phone already registered" }, { status: 409 });
    }
    return NextResponse.json({ error: "Profile creation failed" }, { status: 500 });
  }
}

// ─── PATCH /api/profile — Update profile ──────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, displayName, username, photoDataUrl } = body;

    if (!phone || !displayName) {
      return NextResponse.json({ error: "phone and displayName required" }, { status: 400 });
    }

    if (!hasDb()) {
      if (!global._confiUserStore) global._confiUserStore = {};
      const existing = global._confiUserStore[phone];
      if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });
      const updated = {
        ...existing,
        displayName,
        username: username || existing.username,
        photoDataUrl: photoDataUrl !== undefined ? photoDataUrl : existing.photoDataUrl,
      };
      global._confiUserStore[phone] = updated;
      return NextResponse.json({ user: updated });
    }

    await ensureTables();

    const rows = await q(
      `UPDATE confi_users
       SET display_name = $2,
           username = COALESCE($3, username),
           photo_data_url = COALESCE($4, photo_data_url),
           updated_at = NOW()
       WHERE phone = $1
       RETURNING phone, email, username, display_name, photo_data_url, created_at`,
      [phone, displayName, username || null, photoDataUrl || null]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: rowToUser(rows[0] as UserRow) });
  } catch (err: unknown) {
    console.error("[profile PATCH]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// ─── Global dev store ─────────────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var _confiUserStore:
    | Record<
        string,
        {
          phone: string;
          email: string;
          username: string;
          displayName: string;
          photoDataUrl: string | null;
          createdAt: string;
        }
      >
    | undefined;
}