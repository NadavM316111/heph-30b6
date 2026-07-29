import { NextRequest, NextResponse } from "next/server";
import { q, hasDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    if (!hasDb()) {
      return NextResponse.json({ ok: true, profile: { email } });
    }

    const rows = await q(
      `SELECT email, phone, display_name, handle, avatar_url
       FROM confi_profiles WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ ok: true, profile: { email } });
    }

    const r = rows[0];
    return NextResponse.json({
      ok: true,
      profile: {
        email: r.email,
        phone: r.phone,
        displayName: r.display_name,
        handle: r.handle,
        avatarUrl: r.avatar_url,
      },
    });
  } catch (err) {
    console.error("Profile by-email error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}