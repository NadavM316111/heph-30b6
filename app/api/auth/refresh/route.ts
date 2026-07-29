import { NextRequest, NextResponse } from "next/server";
import { q, P, ensure } from "@/lib/db";
import { verifyJwt, signAccessToken, hashToken } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  try {
    await ensure();
    const { refreshToken } = await req.json();
    if (!refreshToken) {
      return NextResponse.json({ error: "Refresh token required." }, { status: 400 });
    }

    const payload = verifyJwt(refreshToken);
    if (!payload || payload.type !== "refresh") {
      return NextResponse.json({ error: "Invalid refresh token." }, { status: 401 });
    }

    const tokenHash = hashToken(refreshToken);
    const rows = await q(
      `SELECT id, user_id, expires_at, revoked FROM ${P}refresh_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "Token not found." }, { status: 401 });
    }

    const record = rows[0] as { id: number; user_id: number; expires_at: string; revoked: boolean };
    if (record.revoked || new Date(record.expires_at) < new Date()) {
      return NextResponse.json({ error: "Token expired or revoked." }, { status: 401 });
    }

    const newAccessToken = signAccessToken(record.user_id, payload.phone);
    return NextResponse.json({ ok: true, accessToken: newAccessToken });
  } catch (err) {
    console.error("[refresh]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}