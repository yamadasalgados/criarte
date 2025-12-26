import crypto from "node:crypto";

/**
 * Segurança:
 * - Sessão assinada via HMAC-SHA256
 * - TTL obrigatório
 * - assinatura verificada com timingSafeEqual
 * - payload mínimo (orderId, phone, iat, exp, v)
 */

const SESSION_VERSION = 1;

// ajuste como quiser (recomendado: 7 dias)
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashPin(pin: string) {
  // PIN deve ser validado no servidor e nunca armazenado no client
  return crypto.createHash("sha256").update(String(pin || ""), "utf8").digest("hex");
}

export function hashPhone(phone: string) {
  // hash simples pra você poder guardar/bater no Firestore sem phone puro
  const p = String(phone || "").trim().toLowerCase();
  return crypto.createHash("sha256").update(p, "utf8").digest("hex");
}

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("Missing SESSION_SECRET in .env.local");
  // evita secret fraco
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
  // remove tudo que não é dígito
  return String(p || "").replace(/[^\d]/g, "");
}

function validateOrderId(orderId: string) {
  const id = String(orderId || "").trim();
  // Firestore doc id pode ter vários chars, mas vamos bloquear coisas estranhas
  if (!id) return null;
  if (id.length < 6 || id.length > 128) return null;
  if (/[\/\\]/.test(id)) return null; // nunca permitir path
  return id;
}

function validatePhone(phone: string) {
  const p = normalizePhoneLoose(phone);
  if (!p) return null;
  // Japão costuma 10~11 dígitos; mas deixo flexível 8~15
  if (p.length < 8 || p.length > 15) return null;
  return p;
}

type SessionPayload = {
  v: number;
  orderId: string;
  phone: string; // por enquanto mantemos (pra bater com o pedido)
  // opcional pro futuro:
  phoneHash?: string;
  iat: number; // ms
  exp: number; // ms
};

export function signSession(
  payload: { orderId: string; phone: string },
  opts?: { ttlMs?: number; includePhoneHash?: boolean }
) {
  const secret = getSecret();

  const orderId = validateOrderId(payload.orderId);
  const phone = validatePhone(payload.phone);

  if (!orderId) throw new Error("Invalid orderId");
  if (!phone) throw new Error("Invalid phone");

  const now = Date.now();
  const ttlMs = Math.max(60 * 1000, Number(opts?.ttlMs || DEFAULT_TTL_MS)); // mínimo 1min
  const exp = now + ttlMs;

  const body: SessionPayload = {
    v: SESSION_VERSION,
    orderId,
    phone,
    ...(opts?.includePhoneHash ? { phoneHash: hashPhone(phone) } : {}),
    iat: now,
    exp,
  };

  // JSON estável
  const data = JSON.stringify(body);

  const sig = crypto.createHmac("sha256", secret).update(data, "utf8").digest("hex");
  const token = Buffer.from(data, "utf8").toString("base64url") + "." + sig;

  return token;
}

export function verifySession(
  token: string | undefined | null
): { orderId: string; phone: string; phoneHash?: string } | null {
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

  if (!parsed) return null;
  if (parsed.v !== SESSION_VERSION) return null;

  const orderId = validateOrderId(parsed.orderId);
  const phone = validatePhone(parsed.phone);
  if (!orderId || !phone) return null;

  const now = Date.now();
  const iat = Number(parsed.iat || 0);
  const exp = Number(parsed.exp || 0);

  // iat/exp coerentes
  if (!Number.isFinite(iat) || !Number.isFinite(exp)) return null;
  if (exp <= now) return null;

  // evita token “do futuro” muito grande (clock skew)
  if (iat > now + 5 * 60 * 1000) return null;

  // opcional: limite máximo de vida (mesmo que alguém assine com TTL absurdo)
  const maxLife = 30 * 24 * 60 * 60 * 1000; // 30 dias
  if (exp - iat > maxLife) return null;

  // se phoneHash existir, valida formato
  const phoneHash =
    typeof parsed.phoneHash === "string" && /^[a-f0-9]{64}$/i.test(parsed.phoneHash)
      ? parsed.phoneHash
      : undefined;

  return { orderId, phone, phoneHash };
}

export function make6DigitCode() {
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(6, "0");
}
