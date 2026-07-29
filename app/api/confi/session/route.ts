import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "No token" }, { status: 400 });
    }

    const sessionRes = await q(
      `SELECT user_id, expires_at FROM confi_sessions WHERE token = $1`,
      [token]
    );

    if (sessionRes.rows.length === 0) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const session = sessionRes.rows[0];

    if (new Date(session.expires_at) < new Date()) {
      await q(`DELETE FROM confi_sessions WHERE token = $1`, [token]);
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    const userRes = await q(
      `SELECT user_id, phone, email, display_name, legal_name, avatar_seed, kyc_confirmed, verified, created_at
       FROM confi_users WHERE user_id = $1`,
      [session.user_id]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, user: userRes.rows[0] });
  } catch (err) {
    console.error("Session error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}