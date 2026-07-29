import { NextResponse } from "next/server";
import { q, hasDb } from "@/lib/db";

const P = process.env.APP_TABLE_PREFIX ?? "confi";

export async function POST() {
  if (!hasDb()) {
    return NextResponse.json({ error: "No database configured" }, { status: 503 });
  }

  try {
    // Users table
    await q(`
      CREATE TABLE IF NOT EXISTS ${P}_users (
        id TEXT PRIMARY KEY,
        phone_hash TEXT UNIQUE,
        phone_encrypted TEXT,
        email_encrypted TEXT,
        email_hash TEXT UNIQUE,
        display_name TEXT,
        legal_name_encrypted TEXT,
        avatar_url TEXT,
        profile_complete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `, []);

    // OTP table
    await q(`
      CREATE TABLE IF NOT EXISTS ${P}_otps (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        identifier_type TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        attempts INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `, []);

    // Sessions table
    await q(`
      CREATE TABLE IF NOT EXISTS ${P}_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES ${P}_users(id) ON DELETE CASCADE,
        refresh_token TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_used TIMESTAMPTZ DEFAULT NOW()
      )
    `, []);

    return NextResponse.json({ ok: true, message: "Identity tables initialized" });
  } catch (err) {
    console.error("DB init error:", err);
    return NextResponse.json({ error: "Failed to initialize tables" }, { status: 500 });
  }
}