export async function sha256Hex(input: string) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizePhoneJP(input: string) {
  // simples: remove espaços e hífens
  return String(input || "").trim().replace(/[^\d+]/g, "");
}

export function normalizeName(input: string) {
  return String(input || "").trim().toLowerCase();
}
