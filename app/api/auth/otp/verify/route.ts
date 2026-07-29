import { NextRequest, NextResponse } from "next/server";
import { q, P, ensure } from "@/lib/db";
import { hashToken, signAccessToken, signRefreshToken, signTempToken } from "@/lib/jwt";
import { formatUser } from "@/lib/auth-helpers";
import type { AuthUser } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    await ensure();
    const { phone, code } = await req.json();
    if (!phone || !code || typeof code !== "string" || code.length !== 6) {
      return NextResponse.json({ error: "Phone and 6-digit code required." }, { status: 400 });
    }

    const codeHash = hashToken(code);
    const rows = await q(
      `SELECT id, used, expires_at FROM ${P}otp_codes
       WHERE phone = $1 AND code_hash = $2 AND used = false
       ORDER BY created_at DESC LIMIT 1`,
      [phone, codeHash]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
    }

    const record = rows[0] as { id: number; used: boolean; expires_at: string };
    if (new Date(record.expires_at) < new Date()) {
      return NextResponse.json({ error: "Code has expired. Request a new one." }, { status: 400 });
    }

    // Mark OTP as used
    await q(`UPDATE ${P}otp_codes SET used = true WHERE id = $1`, [record.id]);

    // Check if user exists
    const userRows = await q(
      `SELECT id, phone, email, display_name, avatar_color, kyc_verified, kyc_name,
              kyc_dob::text, created_at FROM ${P}users WHERE phone = $1`,
      [phone]
    );

    if (!userRows.length) {
      // New user — issue temp token for profile creation
      const tempToken = signTempToken(phone);
      return NextResponse.json({ ok: true, isNewUser: true, tempToken });
    }

    // Existing user — issue real tokens
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
      isNewUser: false,
      accessToken,
      refreshToken,
      user: formatUser(user),
    });
  } catch (err) {
    console.error("[otp/verify]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}