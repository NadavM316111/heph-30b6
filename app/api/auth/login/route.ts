import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { q, P } from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/auth-utils";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    const rows = await q(
      `SELECT id, email, password_hash, display_name, legal_full_name, legal_name_verified, avatar, email_verified FROM ${P}users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const user = rows[0] as {
      id: number;
      email: string;
      password_hash: string;
      display_name: string | null;
      legal_full_name: string | null;
      legal_name_verified: boolean;
      avatar: string;
      email_verified: boolean;
    };

    if (!user.email_verified) {
      return NextResponse.json(
        { error: "Please verify your email first" },
        { status: 403 }
      );
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      displayName: user.display_name ?? undefined,
      legalNameVerified: user.legal_name_verified,
    });
    const refreshToken = signRefreshToken({
      userId: user.id,
      email: user.email,
    });

    await q(
      `UPDATE ${P}users SET refresh_token = $1, updated_at = NOW() WHERE id = $2`,
      [refreshToken, user.id]
    );

    return NextResponse.json({
      ok: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        legalFullName: user.legal_full_name,
        legalNameVerified: user.legal_name_verified,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}