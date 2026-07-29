import { NextRequest, NextResponse } from "next/server";
import { q, P, ensure } from "@/lib/db";
import { getUserFromToken, formatUser } from "@/lib/auth-helpers";
import type { AuthUser } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    await ensure();
    const user = await getUserFromToken(req.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { kycName, kycDob } = await req.json();

    if (!kycName || typeof kycName !== "string" || kycName.trim().split(" ").length < 2) {
      return NextResponse.json({ error: "Full legal name (first and last) required." }, { status: 400 });
    }
    if (!kycDob) {
      return NextResponse.json({ error: "Date of birth required." }, { status: 400 });
    }

    const dob = new Date(kycDob);
    if (isNaN(dob.getTime())) {
      return NextResponse.json({ error: "Invalid date of birth." }, { status: 400 });
    }

    const ageMs = Date.now() - dob.getTime();
    const ageYears = ageMs / (365.25 * 24 * 3600 * 1000);
    if (ageYears < 18) {
      return NextResponse.json({ error: "Must be 18 or older to activate Confidential Mode." }, { status: 400 });
    }
    if (ageYears > 120) {
      return NextResponse.json({ error: "Invalid date of birth." }, { status: 400 });
    }

    await q(
      `UPDATE ${P}users
       SET kyc_verified = true, kyc_name = $1, kyc_dob = $2::date, updated_at = NOW()
       WHERE id = $3`,
      [kycName.trim(), kycDob, user.id]
    );

    const updated = await q(
      `SELECT id, phone, email, display_name, avatar_color, kyc_verified, kyc_name,
              kyc_dob::text, created_at FROM ${P}users WHERE id = $1`,
      [user.id]
    );

    return NextResponse.json({ ok: true, user: formatUser(updated[0] as AuthUser) });
  } catch (err) {
    console.error("[kyc]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}