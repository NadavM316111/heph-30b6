import { q, P, ensure } from "./db";
import { verifyJwt } from "./jwt";

export interface AuthUser {
  id: number;
  phone: string;
  email: string | null;
  display_name: string;
  avatar_color: string;
  kyc_verified: boolean;
  kyc_name: string | null;
  kyc_dob: string | null;
  created_at: string;
}

export async function getUserFromToken(authHeader: string | null): Promise<AuthUser | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const payload = verifyJwt(token);
  if (!payload || payload.type !== "access") return null;

  await ensure();
  const rows = await q(
    `SELECT id, phone, email, display_name, avatar_color, kyc_verified, kyc_name,
            kyc_dob::text, created_at FROM ${P}users WHERE id = $1`,
    [payload.sub]
  );
  if (!rows.length) return null;
  return rows[0] as AuthUser;
}

export function formatUser(row: AuthUser) {
  return {
    id: row.id,
    phone: row.phone,
    email: row.email || undefined,
    display_name: row.display_name,
    avatar_color: row.avatar_color,
    kyc_verified: Boolean(row.kyc_verified),
    kyc_name: row.kyc_name || undefined,
    kyc_dob: row.kyc_dob || undefined,
    created_at: row.created_at,
  };
}