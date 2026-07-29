import { NextRequest, NextResponse } from "next/server";
import { q, hasDb } from "@/lib/db";

const P = process.env.APP_TABLE_PREFIX ?? "confi";

export async function POST(req: NextRequest) {
  if (!hasDb()) return NextResponse.json({ error: "No DB" }, { status: 503 });

  const body = await req.json() as { sessionId?: string; userId?: string; allSessions?: boolean };
  const { sessionId, userId, allSessions } = body;

  try {
    if (allSessions && userId) {
      await q(`DELETE FROM ${P}_sessions WHERE user_id = $1`, [userId]);
      return NextResponse.json({ ok: true, message: "All sessions terminated" });
    }

    if (sessionId) {
      await q(`DELETE FROM ${P}_sessions WHERE id = $1`, [sessionId]);
      return NextResponse.json({ ok: true, message: "Session terminated" });
    }

    return NextResponse.json({ error: "No session specified" }, { status: 400 });
  } catch (err) {
    console.error("Logout error:", err);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}