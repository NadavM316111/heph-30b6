import { NextRequest, NextResponse } from "next/server";
import { q, hasDb } from "@/lib/db";
import { refreshAccessToken, parseToken } from "@/lib/jwt";

const P = process.env.APP_TABLE_PREFIX ?? "confi";

export async function POST(req: NextRequest) {
  if (!hasDb()) return NextResponse.json({ error: "No DB" }, { status: 503 });

  const body = await req.json() as { refreshToken: string; sessionId: string };
  const { refreshToken, sessionId } = body;

  if (!refreshToken || !sessionId) {
    return NextResponse.json({ error: "Missing refresh token or session ID" }, { status: 400 });
  }

  try {
    const sessionRows = await q(`
      SELECT s.id, s.user_id, s.refresh_token, s.expires_at,
             u.display_name, u.avatar_url, u.profile_complete, u.phone_encrypted, u.email_encrypted
      FROM ${P}_sessions s
      JOIN ${P}_users u ON u.id = s.user_id
      WHERE s.id = $1
    `, [sessionId]);

    if (sessionRows.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    const session = sessionRows[0] as {
      id: string;
      user_id: string;
      refresh_token: string;
      expires_at: string;
      display_name: string;
      avatar_url: string;
      profile_complete: boolean;
      phone_encrypted: string;
      email_encrypted: string;
    };

    if (session.refresh_token !== refreshToken) {
      return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
    }

    if (Number(session.expires_at) < Math.floor(Date.now() / 1000)) {
      await q(`DELETE FROM ${P}_sessions WHERE id = $1`, [sessionId]);
      return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
    }

    const newAccessToken = refreshAccessToken(refreshToken, {
      userId: session.user_id,
      displayName: session.display_name,
      avatarUrl: session.avatar_url,
      profileComplete: session.profile_complete,
    });

    if (!newAccessToken) {
      return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });
    }

    // Update last used
    await q(`UPDATE ${P}_sessions SET last_used = NOW() WHERE id = $1`, [sessionId]);

    return NextResponse.json({ ok: true, accessToken: newAccessToken });
  } catch (err) {
    console.error("Token refresh error:", err);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}