import { NextRequest, NextResponse } from "next/server";
import { q, hasDb } from "@/lib/db";
import { parseToken, createToken } from "@/lib/jwt";
import { encryptPII, decryptPII } from "@/lib/crypto";

const P = process.env.APP_TABLE_PREFIX ?? "confi";

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function GET(req: NextRequest) {
  if (!hasDb()) return NextResponse.json({ error: "No DB" }, { status: 503 });

  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = parseToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });

  try {
    const rows = await q(`
      SELECT id, display_name, avatar_url, phone_encrypted, email_encrypted,
             legal_name_encrypted, profile_complete, created_at
      FROM ${P}_users WHERE id = $1
    `, [payload.userId]);

    if (rows.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const u = rows[0] as {
      id: string;
      display_name: string;
      avatar_url: string;
      phone_encrypted: string;
      email_encrypted: string;
      legal_name_encrypted: string;
      profile_complete: boolean;
      created_at: string;
    };

    return NextResponse.json({
      ok: true,
      user: {
        id: u.id,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        phone: u.phone_encrypted ? decryptPII(u.phone_encrypted) : null,
        email: u.email_encrypted ? decryptPII(u.email_encrypted) : null,
        legalName: u.legal_name_encrypted ? decryptPII(u.legal_name_encrypted) : null,
        profileComplete: u.profile_complete,
        createdAt: u.created_at,
      },
    });
  } catch (err) {
    console.error("GET profile error:", err);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!hasDb()) return NextResponse.json({ error: "No DB" }, { status: 503 });

  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = parseToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });

  const body = await req.json() as {
    displayName?: string;
    avatarUrl?: string;
    legalName?: string;
    completeProfile?: boolean;
  };

  const { displayName, avatarUrl, legalName, completeProfile } = body;

  if (!displayName || displayName.trim().length < 2) {
    return NextResponse.json({ error: "Display name must be at least 2 characters" }, { status: 400 });
  }

  try {
    const encLegal = legalName ? encryptPII(legalName.trim()) : null;
    const profileComplete = completeProfile ?? true;

    await q(`
      UPDATE ${P}_users SET
        display_name = $1,
        avatar_url = $2,
        legal_name_encrypted = $3,
        profile_complete = $4,
        updated_at = NOW()
      WHERE id = $5
    `, [displayName.trim(), avatarUrl ?? null, encLegal, profileComplete, payload.userId]);

    // Issue new token with updated profile data
    const newToken = createToken({
      userId: payload.userId,
      displayName: displayName.trim(),
      avatarUrl: avatarUrl,
      legalName: legalName,
      profileComplete,
      phone: payload.phone,
      email: payload.email,
    });

    return NextResponse.json({ ok: true, accessToken: newToken });
  } catch (err) {
    console.error("PUT profile error:", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}