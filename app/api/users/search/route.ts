import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json({ user: null });
  }

  const display_name = req.nextUrl.searchParams.get("display_name");
  if (!display_name) {
    return NextResponse.json({ error: "Missing display_name" }, { status: 400 });
  }

  try {
    await ensure(`
      CREATE TABLE IF NOT EXISTS confi_users (
        email TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const rows = await q(
      `SELECT email, display_name FROM confi_users
       WHERE LOWER(display_name) = LOWER($1)
       LIMIT 1`,
      [display_name]
    );

    const user = (rows as Array<{ email: string; display_name: string }>)[0] || null;
    return NextResponse.json({ user });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ user: null });
  }
}