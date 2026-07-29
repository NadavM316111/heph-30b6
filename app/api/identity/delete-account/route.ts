import { NextRequest, NextResponse } from "next/server";
import { q, hasDb } from "@/lib/db";
import { parseToken } from "@/lib/jwt";

const P = process.env.APP_TABLE_PREFIX ?? "confi";

export async function DELETE(req: NextRequest) {
  if (!hasDb()) return NextResponse.json({ error: "No DB" }, { status: 503 });

  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = parseToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  try {
    await q(`DELETE FROM ${P}_sessions WHERE user_id = $1`, [payload.userId]);
    await q(`DELETE FROM ${P}_users WHERE id = $1`, [payload.userId]);
    return NextResponse.json({ ok: true, message: "Account deleted" });
  } catch (err) {
    console.error("Delete account error:", err);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}