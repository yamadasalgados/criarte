import crypto from "node:crypto";

/**
 * Sessão assinada via HMAC-SHA256
 * - payload: { phone, orderId, iat, exp }
 */

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("Missing SESSION_SECRET in .env.local");
  if (s.length < 32) throw new Error("SESSION_SECRET muito curto (use >= 32 chars).");
  return s;
}

function safeEqualHex(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function normalizePhoneLoose(p: string) {
  return String(p || "").replace(/[^\d]/g, "");
}

function validatePhone(phone: string) {
  const p = normalizePhoneLoose(phone);
  if (!p) return null;
  if (p.length < 8 || p.length > 15) return null;
  return p;
}

// 1. Adicionado orderId ao tipo da Sessão
type SessionPayload = {
  phone: string; 
  orderId: string; 
  iat: number; 
  exp: number; 
};

export function hashPin(pin: string) {
  return crypto.createHash("sha256").update(String(pin || ""), "utf8").digest("hex");
}

// 2. Função signSession agora exige o orderId no payload
export function signSession(payload: { phone: string; orderId: string }, opts?: { ttlMs?: number }) {
  const secret = getSecret();

  const phone = validatePhone(payload.phone);
  if (!phone) throw new Error("Invalid phone");

  const orderId = String(payload.orderId || "").trim();
  if (!orderId) throw new Error("Invalid orderId");

  const now = Date.now();
  const ttlMs = Math.max(60 * 1000, Number(opts?.ttlMs || DEFAULT_TTL_MS)); 
  const exp = now + ttlMs;

  const body: SessionPayload = { phone, orderId, iat: now, exp };

  const data = JSON.stringify(body);
  const sig = crypto.createHmac("sha256", secret).update(data, "utf8").digest("hex");
  const token = Buffer.from(data, "utf8").toString("base64url") + "." + sig;

  return token;
}

// 3. Função verifySession agora retorna phone e orderId
export function verifySession(token: string | undefined | null): { phone: string; orderId: string } | null {
  if (!token) return null;

  const secret = getSecret();
  const parts = String(token).split(".");
  if (parts.length !== 2) return null;

  const [b64, sig] = parts;
  if (!b64 || !sig) return null;

  let data = "";
  try {
    data = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = crypto.createHmac("sha256", secret).update(data, "utf8").digest("hex");
  if (!safeEqualHex(expected, sig)) return null;

  let parsed: SessionPayload | null = null;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  const phone = validatePhone(parsed?.phone || "");
  const orderId = String(parsed?.orderId || "").trim();
  
  if (!phone || !orderId) return null;

  const now = Date.now();
  const iat = Number(parsed?.iat || 0);
  const exp = Number(parsed?.exp || 0);

  if (!Number.isFinite(iat) || !Number.isFinite(exp)) return null;
  if (exp <= now) return null;
  if (iat > now + 5 * 60 * 1000) return null;

  const maxLife = 30 * 24 * 60 * 60 * 1000;
  if (exp - iat > maxLife) return null;

  return { phone, orderId };
}