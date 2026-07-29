// Lightweight JWT-style token using base64 encoding.
// In production use jose or jsonwebtoken with RS256.

export interface TokenPayload {
  userId: string;
  email?: string;
  phone?: string;
  displayName?: string;
  avatarUrl?: string;
  legalName?: string;
  profileComplete: boolean;
  iat: number;
  exp: number;
}

const SECRET = process.env.APP_TABLE_PREFIX ?? "confi_jwt_secret";

function sign(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  // Simple HMAC simulation — in prod use crypto.createHmac
  const sigData = header + "." + body + SECRET;
  let hash = 0;
  for (let i = 0; i < sigData.length; i++) {
    hash = (hash * 31 + sigData.charCodeAt(i)) >>> 0;
  }
  const sig = hash.toString(36);
  return `${header}.${body}.${sig}`;
}

export function createToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  return sign({ ...payload, iat: now, exp: now + 60 * 60 * 24 * 7 }); // 7 days
}

export function createRefreshToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  return sign({ userId, type: "refresh", iat: now, exp: now + 60 * 60 * 24 * 30 }); // 30 days
}

export function parseToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as TokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function refreshAccessToken(refreshToken: string, userData: Omit<TokenPayload, "iat" | "exp">): string | null {
  try {
    const parts = refreshToken.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as { userId: string; type: string; exp: number };
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now || payload.type !== "refresh") return null;
    if (payload.userId !== userData.userId) return null;
    return createToken(userData);
  } catch {
    return null;
  }
}