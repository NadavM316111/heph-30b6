import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    if (hasDb()) {
      await ensure();
      try {
        const rows = await q(
          `SELECT id, display_name, avatar_color, kyc_verified
           FROM confi_users WHERE email = $1 LIMIT 1`,
          [email]
        ) as Array<{
          id: number;
          display_name: string;
          avatar_color: string;
          kyc_verified: boolean;
        }>;

        if (rows.length > 0) {
          return NextResponse.json({
            ok: true,
            userId: rows[0].id,
            displayName: rows[0].display_name,
            avatarColor: rows[0].avatar_color,
            kycVerified: rows[0].kyc_verified,
          });
        }
      } catch (dbErr) {
        console.error("Profile get DB error:", dbErr);
      }
    }

    // Fallback
    return NextResponse.json({
      ok: true,
      userId: 0,
      displayName: email.split("@")[0],
      avatarColor: "#6c63ff",
      kycVerified: false,
    });
  } catch (err) {
    console.error("Profile get error:", err);
    return NextResponse.json({ error: "Failed to get profile" }, { status: 500 });
  }
}