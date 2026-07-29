import { q, P, hasDb } from "@/lib/db";
export const runtime = "nodejs";

export async function GET() {
  let dbTest = "not run";
  try {
    if (hasDb()) { await q("SELECT 1"); dbTest = "connect ok"; }
    else dbTest = "DATABASE_URL is not set";
  } catch (e: any) { dbTest = "error: " + (e?.message || String(e)); }
  return Response.json({ prefix: P, dbTest });
}
