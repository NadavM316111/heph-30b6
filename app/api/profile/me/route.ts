import { NextRequest, NextResponse } from "next/server";
import { q, P } from "@/lib/db";
import { verifyAccessToken } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const rows = await q(
      `SELECT id, email, display_name, legal_full_name, legal_name_verified, avatar, email_verified, created_at FROM ${P}users WHERE id = $1`,
      [payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = rows[0] as {
      id: number;
      email: string;
      display_name: string | null;
      legal_full_name: string | null;
      legal_name_verified: boolean;
      avatar: string;
      email_verified: boolean;
      created_at: string;
    };

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        legalFullName: user.legal_full_name,
        legalNameVerified: user.legal_name_verified,
        avatar: user.avatar,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    console.error("Profile fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}