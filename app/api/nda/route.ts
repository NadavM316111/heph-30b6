import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      conversationId,
      identityFingerprint,
      ndaFingerprint,
      legalName,
      email,
      acceptedAt,
      deviceMeta,
    } = body;

    if (!conversationId || !identityFingerprint || !ndaFingerprint) {
      return NextResponse.json({ error: "Missing required NDA fields" }, { status: 400 });
    }

    if (!hasDb()) {
      return NextResponse.json({ ok: true, stored: false, ndaFingerprint });
    }

    await ensure();

    await q(
      `CREATE TABLE IF NOT EXISTS confi_nda_records (
        id SERIAL PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        identity_fingerprint TEXT NOT NULL,
        nda_fingerprint TEXT NOT NULL UNIQUE,
        legal_name TEXT,
        email TEXT,
        accepted_at TIMESTAMPTZ,
        device_meta JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      []
    );

    await q(
      `INSERT INTO confi_nda_records
        (conversation_id, identity_fingerprint, nda_fingerprint, legal_name, email, accepted_at, device_meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (nda_fingerprint) DO NOTHING`,
      [
        conversationId,
        identityFingerprint,
        ndaFingerprint,
        legalName ?? null,
        email ?? null,
        acceptedAt ?? null,
        deviceMeta ? JSON.stringify(deviceMeta) : null,
      ]
    );

    return NextResponse.json({ ok: true, stored: true, ndaFingerprint });
  } catch (err) {
    console.error("[nda] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const identityFingerprint = searchParams.get("identityFingerprint");

    if (!conversationId && !identityFingerprint) {
      return NextResponse.json({ error: "Provide conversationId or identityFingerprint" }, { status: 400 });
    }

    if (!hasDb()) {
      return NextResponse.json({ ok: true, records: [], stored: false });
    }

    await ensure();

    let rows;
    if (conversationId) {
      rows = await q(
        `SELECT * FROM confi_nda_records WHERE conversation_id = $1 ORDER BY created_at DESC`,
        [conversationId]
      );
    } else {
      rows = await q(
        `SELECT * FROM confi_nda_records WHERE identity_fingerprint = $1 ORDER BY created_at DESC`,
        [identityFingerprint]
      );
    }

    return NextResponse.json({ ok: true, records: Array.isArray(rows) ? rows : [] });
  } catch (err) {
    console.error("[nda GET] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}