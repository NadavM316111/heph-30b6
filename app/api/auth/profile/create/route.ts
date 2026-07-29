import { NextRequest, NextResponse } from "next/server";
import { q, P, ensure } from "@/lib/db";
import { verifyJwt, signAccessToken, signRefreshToken, hashToken } from "@/lib/jwt";
import { formatUser } from "@/lib/auth-helpers";
import type { AuthUser } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    await ensure();
    const { phone, tempToken, displayName, avatarColor } = await req.json();

    if (!phone || !tempToken || !displayName) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    // Verify temp token
    const payload = verifyJwt(tempToken);
    if (!payload || payload.type !== "temp" || payload.phone !== phone) {
      return NextResponse.json({ error: "Invalid or expired session. Please verify your phone again." }, { status: 401 });
    }

    // Validate display name
    const name = displayName.trim();
    if (name.length < 2 || name.length > 32) {
      return NextResponse.json({ error: "Display name must be 2–32 characters." }, { status: 400 });
    }

    const color = avatarColor || "#4ECDC4";

    // Check if user was already created (race condition guard)
    const existing = await q(`SELECT id FROM ${P}users WHERE phone = $1`, [phone]);
    if (existing.length) {
      return NextResponse.json({ error: "Account already exists. Please log in." }, { status: 409 });
    }

    const inserted = await q(
      `INSERT INTO ${P}users (phone, display_name, avatar_color)
       VALUES ($1, $2, $3) RETURNING id`,
      [phone, name, color]
    );
    const userId = (inserted[0] as { id: number }).id;

    const userRows = await q(
      `SELECT id, phone, email, display_name, avatar_color, kyc_verified, kyc_name,
              kyc_dob::text, created_at FROM ${P}users WHERE id = $1`,
      [userId]
    );
    const user = userRows[0] as AuthUser;

    const accessToken = signAccessToken(user.id, user.phone);
    const refreshToken = signRefreshToken(user.id, user.phone);
    const refreshHash = hashToken(refreshToken);

    await q(
      `INSERT INTO ${P}refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [user.id, refreshHash]
    );

    return NextResponse.json({
      ok: true,
      accessToken,
      refreshToken,
      user: formatUser(user),
    });
  } catch (err) {
    console.error("[profile/create]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}