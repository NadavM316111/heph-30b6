import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

async function initTable() {
  await ensure(`
    CREATE TABLE IF NOT EXISTS confi_nda_signatures (
      id SERIAL PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      signer_confi_id TEXT NOT NULL,
      signer_phone TEXT NOT NULL,
      signer_display_name TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      signed_at TIMESTAMPTZ DEFAULT NOW(),
      nda_version TEXT DEFAULT '1.0',
      UNIQUE(conversation_id, signer_confi_id)
    )
  `);
}

export async function POST(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    await initTable();
    const body = await req.json();
    const { conversationId, signerConfiId, signerPhone, signerDisplayName } = body;

    if (!conversationId || !signerConfiId || !signerPhone || !signerDisplayName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const ua = req.headers.get("user-agent") ?? "unknown";

    // Upsert signature
    await q(
      `INSERT INTO confi_nda_signatures
        (conversation_id, signer_confi_id, signer_phone, signer_display_name, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (conversation_id, signer_confi_id) DO UPDATE SET signed_at = NOW()`,
      [conversationId, signerConfiId, signerPhone, signerDisplayName, ip, ua]
    );

    return NextResponse.json({
      ok: true,
      signatureId: `NDA-${conversationId}-${signerConfiId}-${Date.now()}`,
      signedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("NDA signature error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    await initTable();
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }

    const signatures = await q(
      "SELECT * FROM confi_nda_signatures WHERE conversation_id = $1 ORDER BY signed_at ASC",
      [conversationId]
    );

    return NextResponse.json({
      conversationId,
      signatures: signatures.map((s) => ({
        signerConfiId: s.signer_confi_id,
        signerDisplayName: s.signer_display_name,
        signedAt: s.signed_at,
        ndaVersion: s.nda_version,
      })),
    });
  } catch (err) {
    console.error("NDA GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}