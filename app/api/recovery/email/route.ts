import { NextRequest, NextResponse } from "next/server";
import { q, hasDb } from "@/lib/db";

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    if (hasDb()) {
      await q(
        `CREATE TABLE IF NOT EXISTS confi_recovery_tokens (
          id SERIAL PRIMARY KEY,
          email TEXT NOT NULL,
          token TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        []
      );
      await q(`UPDATE confi_recovery_tokens SET used = TRUE WHERE email = $1`, [email]);
      await q(
        `INSERT INTO confi_recovery_tokens (email, token, expires_at) VALUES ($1, $2, $3)`,
        [email, token, expiresAt.toISOString()]
      );
    }

    // In production: send email via SendGrid/SES with a link containing the token.
    // Since no email API key exists in our allowed env vars, we log and return devToken.
    console.log(`[CONFI RECOVERY] Email: ${email}, Token: ${token}`);

    return NextResponse.json({ ok: true, devToken: token });
  } catch (err) {
    console.error("Recovery email error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}