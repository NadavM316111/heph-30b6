import { NextRequest, NextResponse } from "next/server";
import { q, P } from "@/lib/db";
import { verifyAccessToken } from "@/lib/auth-utils";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (token) {
      const payload = verifyAccessToken(token);
      if (payload) {
        await q(
          `UPDATE ${P}users SET refresh_token = NULL, updated_at = NOW() WHERE id = $1`,
          [payload.userId]
        );
      }
    }

    return NextResponse.json({ ok: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}