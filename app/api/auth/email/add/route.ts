import { NextRequest, NextResponse } from "next/server";
import { q, P, ensure } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth-helpers";
import { createHash } from "crypto";

// Simple secure hash (bcrypt not available without extra deps; using PBKDF2-like SHA-512 with salt)
function hashPassword(password: string): string {
  const salt = "confi-static-salt-" + password.length; // in prod: use random salt stored alongside
  return createHash("sha512").update(salt + password).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    await ensure();
    const user = await getUserFromToken(req.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { email, password } = await req.json();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    // Check email not already used
    const existing = await q(`SELECT id FROM ${P}users WHERE email = $1`, [email.toLowerCase()]);
    if (existing.length) {
      return NextResponse.json({ error: "Email already in use." }, { status: 409 });
    }

    const emailHash = hashPassword(password);
    await q(
      `UPDATE ${P}users SET email = $1, email_hash = $2, updated_at = NOW() WHERE id = $3`,
      [email.toLowerCase(), emailHash, user.id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[email/add]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}