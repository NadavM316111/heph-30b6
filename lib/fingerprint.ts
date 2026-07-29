/**
 * Device fingerprinting for legal session binding.
 * Collects non-PII browser signals and hashes them deterministically.
 * This binds the JWT session to a specific device for legal traceability.
 */

export async function generateFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "ssr-fingerprint";

  const components: string[] = [];

  // Screen properties
  components.push(`${window.screen.width}x${window.screen.height}`);
  components.push(`${window.screen.colorDepth}`);
  components.push(`${window.devicePixelRatio || 1}`);

  // Navigator properties
  components.push(navigator.language || "");
  components.push(navigator.platform || "");
  components.push(String(navigator.hardwareConcurrency || 0));
  components.push(navigator.userAgent || "");

  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone || "");

  // Canvas fingerprint (non-PII hardware signal)
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("Confi🔒", 2, 15);
      ctx.fillStyle = "rgba(102,204,0,0.7)";
      ctx.fillText("Confi🔒", 4, 17);
      components.push(canvas.toDataURL().slice(-50));
    }
  } catch {
    components.push("no-canvas");
  }

  // WebGL renderer (non-PII hardware signal)
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "");
      }
    }
  } catch {
    components.push("no-webgl");
  }

  // Audio context fingerprint
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      components.push(String(ctx.sampleRate));
      await ctx.close();
    }
  } catch {
    components.push("no-audio");
  }

  const raw = components.join("|||");
  return await sha256(raw);
}

export function generateUserId(email: string, fingerprint: string): string {
  // Deterministic UID from email + fingerprint + timestamp
  // In production this would be server-side; here we simulate for demo
  const seed = email.toLowerCase().trim() + fingerprint.slice(0, 16);
  return `confi_${simpleHash(seed)}_${Date.now().toString(36)}`;
}

async function sha256(message: string): Promise<string> {
  try {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return simpleHash(message);
  }
}

function simpleHash(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, "0");
}