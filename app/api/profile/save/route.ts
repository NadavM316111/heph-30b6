import { NextRequest, NextResponse } from "next/server";
import { q, hasDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email, phone, displayName, handle, avatarBase64 } = await req.json();

    if (!email || !displayName || !handle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Store avatar as data-URI in DB (for a real app, upload to S3/R2 instead)
    const avatarUrl = avatarBase64 || null;

    if (hasDb()) {
      await q(
        `CREATE TABLE IF NOT EXISTS confi_profiles (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          phone TEXT,
          display_name TEXT NOT NULL,
          handle TEXT UNIQUE NOT NULL,
          avatar_url TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        []
      );

      // Check handle uniqueness
      const existing = await q(
        `SELECT id FROM confi_profiles WHERE handle = $1 AND email != $2`,
        [handle, email]
      );
      if (existing && existing.length > 0) {
        return NextResponse.json({ error: "Handle already taken" }, { status: 409 });
      }

      await q(
        `INSERT INTO confi_profiles (email, phone, display_name, handle, avatar_url)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET
           phone = EXCLUDED.phone,
           display_name = EXCLUDED.display_name,
           handle = EXCLUDED.handle,
           avatar_url = EXCLUDED.avatar_url,
           updated_at = NOW()`,
        [email, phone || null, displayName, handle, avatarUrl]
      );
    }

    return NextResponse.json({ ok: true, avatarUrl });
  } catch (err) {
    console.error("Profile save error:", err);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}