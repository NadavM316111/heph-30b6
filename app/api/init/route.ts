import { NextResponse } from "next/server";
import { hasDb } from "@/lib/db";
import { initDb } from "@/lib/ensure-tables";

export async function GET() {
  if (!hasDb()) {
    return NextResponse.json({ ok: true, db: false, message: "No database configured" });
  }
  try {
    await initDb();
    return NextResponse.json({ ok: true, db: true, message: "Database initialized" });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}