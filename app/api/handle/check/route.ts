import { NextRequest, NextResponse } from "next/server";
import { q, hasDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get("handle");

  if (!handle || handle.length < 3) {
    return NextResponse.json({ available: false, error: "Handle too short" });
  }
  if (!/^[a-z0-9_]+$/.test(handle)) {
    return NextResponse.json({ available: false, error: "Invalid characters" });
  }

  if (!hasDb()) {
    // No DB in dev → always available
    return NextResponse.json({ available: true });
  }

  try {
    const rows = await q(
      `SELECT id FROM confi_profiles WHERE handle = $1 LIMIT 1`,
      [handle]
    );
    return NextResponse.json({ available: !rows || rows.length === 0 });
  } catch {
    // Table may not exist yet
    return NextResponse.json({ available: true });
  }
}