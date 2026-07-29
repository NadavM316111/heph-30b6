import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json({ ok: false, error: "No database" });
  }

  const { email, display_name } = await req.json();
  if (!email || !display_name) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    await ensure(`
      CREATE TABLE IF NOT EXISTS confi_users (
        email TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await q(
      `INSERT INTO confi_users (email, display_name)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name`,
      [email, display_name]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}