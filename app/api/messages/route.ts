import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

async function initTable() {
  await ensure(`
    CREATE TABLE IF NOT EXISTS confi_messages (
      id TEXT PRIMARY KEY,
      from_confi_id TEXT NOT NULL,
      to_confi_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      text TEXT NOT NULL,
      is_confidential BOOLEAN DEFAULT FALSE,
      nda_accepted BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await ensure(`
    CREATE INDEX IF NOT EXISTS idx_confi_messages_conversation
    ON confi_messages(conversation_id, created_at DESC)
  `);
}

function makeConversationId(a: string, b: string): string {
  return [a, b].sort().join("_");
}

export async function POST(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    await initTable();
    const body = await req.json();
    const { id, fromConfiId, toConfiId, text, isConfidential, ndaAccepted } = body;

    if (!fromConfiId || !toConfiId || !text) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const conversationId = makeConversationId(fromConfiId, toConfiId);
    const msgId = id ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    await q(
      `INSERT INTO confi_messages
        (id, from_confi_id, to_confi_id, conversation_id, text, is_confidential, nda_accepted)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [msgId, fromConfiId, toConfiId, conversationId, text, isConfidential ?? false, ndaAccepted ?? false]
    );

    return NextResponse.json({ ok: true, messageId: msgId, conversationId });
  } catch (err) {
    console.error("Messages POST error:", err);
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
    const myConfiId = searchParams.get("myConfiId");
    const theirConfiId = searchParams.get("theirConfiId");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    if (!myConfiId || !theirConfiId) {
      return NextResponse.json({ error: "myConfiId and theirConfiId required" }, { status: 400 });
    }

    const conversationId = makeConversationId(myConfiId, theirConfiId);

    const messages = await q(
      `SELECT * FROM confi_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [conversationId, limit]
    );

    return NextResponse.json({
      conversationId,
      messages: messages.map((m) => ({
        id: m.id,
        fromConfiId: m.from_confi_id,
        toConfiId: m.to_confi_id,
        text: m.text,
        ts: m.created_at,
        confidential: m.is_confidential,
        ndaAccepted: m.nda_accepted,
      })),
    });
  } catch (err) {
    console.error("Messages GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}