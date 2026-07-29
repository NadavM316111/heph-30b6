import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;
    if (token) {
      await q(`DELETE FROM confi_sessions WHERE token = $1`, [token]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Logout error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}