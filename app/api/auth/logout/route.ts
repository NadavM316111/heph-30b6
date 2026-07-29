import { NextRequest, NextResponse } from "next/server";
import { q, P, ensure } from "@/lib/db";
import { hashToken } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  try {
    await ensure();
    const { refreshToken } = await req.json();
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await q(
        `UPDATE ${P}refresh_tokens SET revoked = true WHERE token_hash = $1`,
        [tokenHash]
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[logout]", err);
    return NextResponse.json({ ok: true }); // Always succeed logout
  }
}