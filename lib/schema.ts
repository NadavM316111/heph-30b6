import { q, hasDb } from "@/lib/db";

export async function ensureConfiTables(): Promise<void> {
  if (!hasDb()) return;

  try {
    // Main users table with all fields needed for NDA enforceability
    await q(
      `CREATE TABLE IF NOT EXISTS confi_users (
        id                    SERIAL PRIMARY KEY,
        email                 TEXT NOT NULL UNIQUE,
        phone                 TEXT,
        display_name          TEXT,
        avatar_color          TEXT DEFAULT '#6c63ff',
        
        -- Legal identity fields for NDA enforceability
        legal_first_name      TEXT,
        legal_last_name       TEXT,
        country               TEXT,
        government_id_number  TEXT,
        
        -- KYC status
        kyc_verified          BOOLEAN DEFAULT false,
        kyc_submitted_at      TIMESTAMPTZ,
        
        -- Timestamps
        created_at            TIMESTAMPTZ DEFAULT NOW(),
        updated_at            TIMESTAMPTZ DEFAULT NOW()
      )`,
      []
    );

    // OTP tracking table for persistent rate limiting
    await q(
      `CREATE TABLE IF NOT EXISTS confi_otp_attempts (
        id          SERIAL PRIMARY KEY,
        phone       TEXT NOT NULL,
        attempts    INT DEFAULT 0,
        locked_until TIMESTAMPTZ,
        last_sent   TIMESTAMPTZ DEFAULT NOW(),
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )`,
      []
    );

    // NDA acceptance log — critical for legal enforceability
    await q(
      `CREATE TABLE IF NOT EXISTS confi_nda_acceptances (
        id              SERIAL PRIMARY KEY,
        user_id         INT REFERENCES confi_users(id),
        conversation_id TEXT NOT NULL,
        accepted_at     TIMESTAMPTZ DEFAULT NOW(),
        ip_address      TEXT,
        user_agent      TEXT,
        nda_version     TEXT DEFAULT '1.0'
      )`,
      []
    );

    // Conversation metadata
    await q(
      `CREATE TABLE IF NOT EXISTS confi_conversations (
        id                SERIAL PRIMARY KEY,
        conversation_uid  TEXT UNIQUE NOT NULL,
        name              TEXT,
        confidential_mode BOOLEAN DEFAULT false,
        nda_activated_at  TIMESTAMPTZ,
        created_by        INT REFERENCES confi_users(id),
        created_at        TIMESTAMPTZ DEFAULT NOW()
      )`,
      []
    );

    console.log("[Confi] Database tables ensured");
  } catch (err) {
    console.error("[Confi] Schema error:", err);
  }
}