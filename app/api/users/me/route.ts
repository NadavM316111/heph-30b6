import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json({ display_name: null });
  }

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  try {
    await ensure(`
      CREATE TABLE IF NOT EXISTS confi_users (
        email TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const rows = await q(
      `SELECT display_name FROM confi_users WHERE email = $1`,
      [email]
    );
    const display_name = (rows as Array<{ display_name: string }>)[0]?.display_name || null;
    return NextResponse.json({ display_name });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ display_name: null });
  }
}