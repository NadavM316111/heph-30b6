// Pure-JS JWT implementation (no external deps needed beyond Node crypto)
import { createHmac, randomBytes } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET ?? "confi-dev-secret-change-in-prod-min32chars!!";
const ACCESS_EXPIRES_IN = 15 * 60; // 15 minutes
const REFRESH_EXPIRES_IN = 30 * 24 * 60 * 60; // 30 days

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
}

export interface JwtPayload {
  sub: number;
  phone: string;
  type: "access" | "refresh" | "temp";
  iat: number;
  exp: number;
}

export function signJwt(payload: Omit<JwtPayload, "iat" | "exp">, expiresIn = ACCESS_EXPIRES_IN): string {
  const now = Math.floor(Date.now() / 1000);
  const full: JwtPayload = { ...payload, iat: now, exp: now + expiresIn };
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(full));
  const sig = createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    const [header, body, sig] = token.split(".");
    const expected = createHmac("sha256", JWT_SECRET)
      .update(`${header}.${body}`)
      .digest("base64")
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    if (sig !== expected) return null;
    const payload: JwtPayload = JSON.parse(base64UrlDecode(body));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function signAccessToken(userId: number, phone: string): string {
  return signJwt({ sub: userId, phone, type: "access" }, ACCESS_EXPIRES_IN);
}

export function signRefreshToken(userId: number, phone: string): string {
  return signJwt({ sub: userId, phone, type: "refresh" }, REFRESH_EXPIRES_IN);
}

export function signTempToken(phone: string): string {
  return signJwt({ sub: 0, phone, type: "temp" }, 10 * 60); // 10 min
}

export function generateOtp(): string {
  const buf = randomBytes(3);
  const num = ((buf[0] << 16) | (buf[1] << 8) | buf[2]) % 1000000;
  return num.toString().padStart(6, "0");
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHmac("sha256", JWT_SECRET).update(token).digest("hex");
}