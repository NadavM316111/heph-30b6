import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

async function setupTables() {
  await ensure(`
    CREATE TABLE IF NOT EXISTS confi_users (
      email TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
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
}

export async function GET(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json({ conversations: [] });
  }
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  try {
    await setupTables();

    const rows = await q(
      `SELECT
         c.id,
         CASE WHEN c.email_a = $1 THEN c.email_b ELSE c.email_a END AS other_email,
         c.confidential,
         c.created_at
       FROM confi_conversations c
       WHERE c.email_a = $1 OR c.email_b = $1
       ORDER BY c.created_at DESC`,
      [email]
    );

    const conversations = await Promise.all(
      (rows as Array<{ id: number; other_email: string; confidential: boolean; created_at: string }>).map(async (row) => {
        // Get display name
        const userRows = await q(
          `SELECT display_name FROM confi_users WHERE email = $1`,
          [row.other_email]
        );
        const other_display =
          (userRows as Array<{ display_name: string }>)[0]?.display_name || row.other_email;

        // Get last message
        const msgRows = await q(
          `SELECT content, created_at, confidential FROM confi_messages
           WHERE conv_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [row.id]
        );
        const lastMsg = (msgRows as Array<{ content: string; created_at: string; confidential: boolean }>)[0];

        return {
          id: row.id,
          other_email: row.other_email,
          other_display,
          last_message: lastMsg?.content || "",
          last_at: lastMsg?.created_at || row.created_at,
          confidential: lastMsg?.confidential ?? row.confidential,
          unread: 0,
        };
      })
    );

    // Sort by last message time
    conversations.sort(
      (a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime()
    );

    return NextResponse.json({ conversations });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ conversations: [] });
  }
}