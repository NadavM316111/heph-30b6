import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

async function ensureNDATable() {
  await ensure(`
    CREATE TABLE IF NOT EXISTS confi_nda_signatures (
      id            SERIAL PRIMARY KEY,
      signature_uid TEXT UNIQUE NOT NULL,
      user_uid      TEXT NOT NULL,
      crypto_id     TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      participant_ids TEXT[] NOT NULL,
      accepted_at   TIMESTAMPTZ DEFAULT NOW(),
      ip_hash       TEXT,
      jurisdiction  TEXT DEFAULT 'international',
      nda_version   TEXT DEFAULT '1.0',
      expires_at    TIMESTAMPTZ
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
    await ensureNDATable();
    const body = await req.json();
    const { userUid, cryptoId, conversationId, participantIds, jurisdiction } =
      body;

    if (!userUid || !cryptoId || !conversationId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Generate a signature UID
    const sigUid = `SIG-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 10)
      .toUpperCase()}`;

    // NDA expires in 5 years
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 5);

    const result = await q(
      `INSERT INTO confi_nda_signatures
         (signature_uid, user_uid, crypto_id, conversation_id, participant_ids, jurisdiction, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (signature_uid) DO NOTHING
       RETURNING *`,
      [
        sigUid,
        userUid,
        cryptoId,
        conversationId,
        participantIds || [],
        jurisdiction || "international",
        expiresAt.toISOString(),
      ]
    );

    return NextResponse.json({
      ok: true,
      signature: result.rows[0] || { signature_uid: sigUid },
    });
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
    await ensureNDATable();
    const { searchParams } = new URL(req.url);
    const userUid = searchParams.get("userUid");
    const conversationId = searchParams.get("conversationId");

    if (!userUid) {
      return NextResponse.json({ error: "userUid required" }, { status: 400 });
    }

    let rows;
    if (conversationId) {
      const result = await q(
        `SELECT * FROM confi_nda_signatures
         WHERE user_uid = $1 AND conversation_id = $2
         ORDER BY accepted_at DESC`,
        [userUid, conversationId]
      );
      rows = result.rows;
    } else {
      const result = await q(
        `SELECT * FROM confi_nda_signatures
         WHERE user_uid = $1
         ORDER BY accepted_at DESC`,
        [userUid]
      );
      rows = result.rows;
    }

    return NextResponse.json({ ok: true, signatures: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}