export function generateDeviceFingerprint(): string {
  try {
    const existing = localStorage.getItem("confi_device_fp");
    if (existing) return existing;
  } catch {
    // ignore
  }

  const components: string[] = [
    navigator.userAgent || "",
    navigator.language || "",
    String(screen.width) + "x" + String(screen.height),
    String(screen.colorDepth),
    String(new Date().getTimezoneOffset()),
    navigator.platform || "",
    String(navigator.hardwareConcurrency || 0),
    String((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0),
  ];

  const raw = components.join("|");
  const fingerprint = hashString(raw);

  try {
    localStorage.setItem("confi_device_fp", fingerprint);
  } catch {
    // ignore
  }

  return fingerprint;
}

function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) + hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const unsigned = hash >>> 0;
  return unsigned.toString(16).padStart(8, "0") + "-" +
    Math.random().toString(36).slice(2, 10) + "-" +
    Date.now().toString(36);
}