import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json({ error: "No database" }, { status: 500 });
  }

  const { email_a, email_b } = await req.json();
  if (!email_a || !email_b) {
    return NextResponse.json({ error: "Missing emails" }, { status: 400 });
  }

  try {
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

    // Normalize order so (A,B) and (B,A) map to the same row
    const [ea, eb] = [email_a, email_b].sort();

    // Try to find existing
    const existing = await q(
      `SELECT id FROM confi_conversations WHERE email_a = $1 AND email_b = $2`,
      [ea, eb]
    );
    if ((existing as Array<{ id: number }>).length > 0) {
      return NextResponse.json({ conv_id: (existing as Array<{ id: number }>)[0].id });
    }

    const rows = await q(
      `INSERT INTO confi_conversations (email_a, email_b) VALUES ($1, $2) RETURNING id`,
      [ea, eb]
    );
    const conv_id = (rows as Array<{ id: number }>)[0].id;
    return NextResponse.json({ conv_id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}