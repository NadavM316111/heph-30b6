import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json({ messages: [] });
  }

  const conv_id = req.nextUrl.searchParams.get("conv_id");
  if (!conv_id) return NextResponse.json({ error: "Missing conv_id" }, { status: 400 });

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
    await ensure(`
      CREATE TABLE IF NOT EXISTS confi_users (
        email TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const rows = await q(
      `SELECT m.id, m.sender_email, m.content, m.confidential, m.created_at,
              COALESCE(u.display_name, m.sender_email) AS sender_display
       FROM confi_messages m
       LEFT JOIN confi_users u ON u.email = m.sender_email
       WHERE m.conv_id = $1
       ORDER BY m.created_at ASC`,
      [conv_id]
    );

    return NextResponse.json({ messages: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ messages: [] });
  }
}