import { q } from "./db";

export async function ensureSchema() {
  await q(`
    CREATE TABLE IF NOT EXISTS confi_users (
      id            SERIAL PRIMARY KEY,
      user_id       TEXT UNIQUE NOT NULL,
      phone         TEXT UNIQUE NOT NULL,
      email         TEXT UNIQUE,
      display_name  TEXT NOT NULL,
      legal_name    TEXT NOT NULL,
      avatar_seed   TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      kyc_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
      verified      BOOLEAN NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `, []);

  await q(`
    CREATE TABLE IF NOT EXISTS confi_sessions (
      id         SERIAL PRIMARY KEY,
      token      TEXT UNIQUE NOT NULL,
      user_id    TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `, []);

  await q(`
    CREATE TABLE IF NOT EXISTS confi_otp (
      id         SERIAL PRIMARY KEY,
      phone      TEXT NOT NULL,
      code       TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used       BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `, []);
}