import { NextRequest, NextResponse } from "next/server";
import { q, ensure, hasDb } from "@/lib/db";

// Rate limiting store (in-memory, resets on cold start)
const attemptMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string, max = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = attemptMap.get(ip) ?? { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    attemptMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  attemptMap.set(ip, entry);
  return true;
}

async function ensureTable() {
  await ensure();
  if (!hasDb()) return;
  await q(
    `CREATE TABLE IF NOT EXISTS confi_users (
      id          SERIAL PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      legal_name  TEXT DEFAULT '',
      phone       TEXT DEFAULT '',
      kyc_ok      BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`,
    []
  );
}

// Simple password hashing without bcrypt (pure Node.js crypto)
import { createHash, randomBytes, timingSafeEqual } from "crypto";

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt ?? randomBytes(16).toString("hex");
  const hash = createHash("sha256")
    .update(s + password + process.env.DATABASE_URL?.slice(0, 8))
    .digest("hex");
  return { hash, salt: s };
}

function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}

function makeJwt(email: string): string {
  const payload = Buffer.from(JSON.stringify({ email, iat: Date.now() })).toString("base64url");
  const sig = createHash("sha256")
    .update(payload + (process.env.DATABASE_URL ?? "secret"))
    .digest("base64url");
  return `${payload}.${sig}`;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  let body: { mode?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { mode, email, password } = body;
  if (!mode || !email || !password) {
    return NextResponse.json({ error: "mode, email, and password are required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    await ensureTable();

    if (mode === "signup") {
      // Check existing
      if (hasDb()) {
        const existing = await q("SELECT id FROM confi_users WHERE email = $1", [email]);
        if (existing.length > 0) {
          return NextResponse.json({ error: "Email already registered." }, { status: 409 });
        }
      }
      const { hash, salt } = hashPassword(password);
      const passwordHash = `${salt}:${hash}`;
      if (hasDb()) {
        await q(
          "INSERT INTO confi_users (email, password_hash) VALUES ($1, $2)",
          [email, passwordHash]
        );
      }
      const token = makeJwt(email);
      return NextResponse.json({ ok: true, email, token });
    }

    if (mode === "login") {
      if (!hasDb()) {
        // No DB: allow login for demo
        const token = makeJwt(email);
        return NextResponse.json({ ok: true, email, token });
      }
      const rows = await q("SELECT password_hash FROM confi_users WHERE email = $1", [email]);
      if (rows.length === 0) {
        return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
      }
      const [saltPart, hashPart] = (rows[0].password_hash as string).split(":");
      if (!verifyPassword(password, hashPart, saltPart)) {
        return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
      }
      const token = makeJwt(email);
      return NextResponse.json({ ok: true, email, token });
    }

    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  } catch (err) {
    console.error("[auth]", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}