import { NextRequest, NextResponse } from "next/server";
import { q, hasDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });

    if (!hasDb()) {
      return NextResponse.json({ error: "No database" }, { status: 503 });
    }

    const rows = await q(
      `SELECT email, phone, display_name, handle, avatar_url
       FROM confi_profiles WHERE phone = $1 LIMIT 1`,
      [phone]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Not found" });
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
    console.error("Profile by-phone error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}