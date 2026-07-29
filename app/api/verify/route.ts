import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

async function initTable() {
  if (!hasDb()) return;
  await ensure(`
    CREATE TABLE IF NOT EXISTS confi_verifications (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      verification_id TEXT UNIQUE NOT NULL,
      doc_type TEXT,
      liveness_checks TEXT,
      verified_at TIMESTAMPTZ,
      audit_hash TEXT,
      liveness_passed BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      verificationId,
      docType,
      livenessChecks,
      verifiedAt,
      auditHash,
    } = body;

    if (!email || !verificationId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!hasDb()) {
      return NextResponse.json({ ok: true, stored: false, note: "No DB configured" });
    }

    await initTable();

    const checksJson = JSON.stringify(livenessChecks || []);
    const passed = Array.isArray(livenessChecks) && livenessChecks.length >= 5;

    // Upsert verification record
    await q(
      `INSERT INTO confi_verifications
        (email, verification_id, doc_type, liveness_checks, verified_at, audit_hash, liveness_passed)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (verification_id) DO UPDATE SET
        liveness_checks = EXCLUDED.liveness_checks,
        liveness_passed = EXCLUDED.liveness_passed,
        verified_at = EXCLUDED.verified_at`,
      [email, verificationId, docType, checksJson, verifiedAt || new Date().toISOString(), auditHash, passed]
    );

    return NextResponse.json({ ok: true, verificationId, stored: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "email param required" }, { status: 400 });
  }

  if (!hasDb()) {
    return NextResponse.json({ ok: true, records: [], note: "No DB configured" });
  }

  try {
    await initTable();
    const rows = await q(
      "SELECT verification_id, doc_type, verified_at, liveness_passed, audit_hash, created_at FROM confi_verifications WHERE email = $1 ORDER BY created_at DESC",
      [email]
    );
    return NextResponse.json({ ok: true, records: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}