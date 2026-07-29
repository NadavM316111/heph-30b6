import { ensure } from "@/lib/db";

let initialized = false;

export async function initDb(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    await ensure();
    // Additional Confi-specific table setup
    const { ensureConfiTables } = await import("./schema");
    await ensureConfiTables();
  } catch (err) {
    console.error("[Confi] DB init error:", err);
  }
}