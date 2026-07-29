import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json({ error: "No database" }, { status: 500 });
  }

  const { conv_id, sender_email, content, confidential } = await req.json();
  if (!conv_id || !sender_email || !content) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    await ensure(`
      CREATE TABLE IF NOT EXISTS confi_messages (
        id SERIAL PRIMARY KEY,
        conv_id INTEGER NOT NULL,
        sender_email TEXT NOT NULL,
        content TEXT NOT NULL,
        confidential BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Verify sender is part of this conversation
    await ensure(`
      CREATE TABLE IF NOT EXISTS confi_conversations (
        id SERIAL PRIMARY KEY,
        email_a TEXT NOT NULL,
        email_b TEXT NOT NULL,
        confidential BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(email_a, email_b)
      )
    `);

    const convRows = await q(
      `SELECT id FROM confi_conversations WHERE id = $1 AND (email_a = $2 OR email_b = $2)`,
      [conv_id, sender_email]
    );
    if ((convRows as Array<{ id: number }>).length === 0) {
      return NextResponse.json({ error: "Not authorized for this conversation" }, { status: 403 });
    }

    const rows = await q(
      `INSERT INTO confi_messages (conv_id, sender_email, content, confidential)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [conv_id, sender_email, content, confidential ?? false]
    );
    const id = (rows as Array<{ id: number }>)[0].id;
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}