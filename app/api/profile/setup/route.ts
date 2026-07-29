import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email, displayName, avatarColor, tempToken } = await req.json();

    if (!email || !displayName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const token = Buffer.from(
      `${email}:${Date.now()}:profile`
    ).toString("base64");

    if (hasDb()) {
      await ensure();
      try {
        // Check if user exists
        const existing = await q(
          `SELECT id FROM confi_users WHERE email = $1 LIMIT 1`,
          [email]
        );
        const rows = existing as Array<{ id: number }>;

        if (rows.length > 0) {
          // Update existing
          await q(
            `UPDATE confi_users SET display_name = $1, avatar_color = $2, updated_at = NOW()
             WHERE email = $3`,
            [displayName, avatarColor || "#6c63ff", email]
          );
        } else {
          // Insert new
          await q(
            `INSERT INTO confi_users 
               (email, display_name, avatar_color, kyc_verified, created_at, updated_at)
             VALUES ($1, $2, $3, false, NOW(), NOW())
             ON CONFLICT (email) DO UPDATE 
               SET display_name = EXCLUDED.display_name,
                   avatar_color = EXCLUDED.avatar_color,
                   updated_at = NOW()`,
            [email, displayName, avatarColor || "#6c63ff"]
          );
        }
      } catch (dbErr) {
        console.error("Profile setup DB error:", dbErr);
        // Non-fatal: continue
      }
    }

    return NextResponse.json({ ok: true, token, tempToken });
  } catch (err) {
    console.error("Profile setup error:", err);
    return NextResponse.json({ error: "Profile setup failed" }, { status: 500 });
  }
}