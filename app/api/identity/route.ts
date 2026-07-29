import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      legalName,
      fingerprint,
      tosAcceptedAt,
      deviceMeta,
      phone,
    } = body;

    if (!email || !fingerprint) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!hasDb()) {
      // No DB — return success with in-memory ack
      return NextResponse.json({ ok: true, stored: false, fingerprint });
    }

    await ensure();

    // Create identity_records table if not exists
    await q(
      `CREATE TABLE IF NOT EXISTS confi_identity_records (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        legal_name TEXT,
        phone TEXT,
        fingerprint TEXT NOT NULL UNIQUE,
        tos_accepted_at TIMESTAMPTZ,
        device_meta JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      []
    );

    // Upsert identity record
    await q(
      `INSERT INTO confi_identity_records
        (email, legal_name, phone, fingerprint, tos_accepted_at, device_meta)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (fingerprint) DO UPDATE SET
         email = EXCLUDED.email,
         legal_name = EXCLUDED.legal_name,
         tos_accepted_at = EXCLUDED.tos_accepted_at,
         device_meta = EXCLUDED.device_meta`,
      [
        email,
        legalName ?? null,
        phone ?? null,
        fingerprint,
        tosAcceptedAt ?? null,
        deviceMeta ? JSON.stringify(deviceMeta) : null,
      ]
    );

    return NextResponse.json({ ok: true, stored: true, fingerprint });
  } catch (err) {
    console.error("[identity] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const fingerprint = searchParams.get("fingerprint");

    if (!email && !fingerprint) {
      return NextResponse.json({ error: "Provide email or fingerprint" }, { status: 400 });
    }

    if (!hasDb()) {
      return NextResponse.json({ ok: true, record: null, stored: false });
    }

    await ensure();

    let rows;
    if (fingerprint) {
      rows = await q(
        `SELECT * FROM confi_identity_records WHERE fingerprint = $1 LIMIT 1`,
        [fingerprint]
      );
    } else {
      rows = await q(
        `SELECT * FROM confi_identity_records WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
        [email]
      );
    }

    const record = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    return NextResponse.json({ ok: true, record });
  } catch (err) {
    console.error("[identity GET] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}