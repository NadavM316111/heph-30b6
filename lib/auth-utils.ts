import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "confi-dev-secret-change-in-prod";
const REFRESH_SECRET =
  process.env.REFRESH_SECRET ?? "confi-refresh-dev-secret-change-in-prod";

export interface JWTPayload {
  userId: number;
  email: string;
  displayName?: string;
  legalNameVerified?: boolean;
}

export function signAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "30d" });
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, REFRESH_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}