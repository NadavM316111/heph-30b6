interface AuditEvent {
  type: string;
  email: string;
  fingerprint: string;
  metadata: Record<string, unknown>;
}

export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const existing = getStoredAuditLog();
    const entry = {
      ...event,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
    };
    existing.push(entry);
    // Keep last 500 entries to avoid localStorage bloat
    const trimmed = existing.slice(-500);
    localStorage.setItem("confi_audit_log", JSON.stringify(trimmed));

    // In production: POST to audit API endpoint
    // await fetch("/api/audit", { method: "POST", body: JSON.stringify(entry) });
  } catch {
    console.warn("[CONFI AUDIT] Could not store audit event:", event.type);
  }
}

function getStoredAuditLog(): Array<Record<string, unknown>> {
  try {
    const raw = localStorage.getItem("confi_audit_log");
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getAuditLog(): Array<Record<string, unknown>> {
  return getStoredAuditLog();
}