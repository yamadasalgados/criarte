// src/lib/firebaseAdmin.ts
import admin from "firebase-admin";

/**
 * ✅ Objetivos:
 * - Inicializar Firebase Admin SDK uma única vez (hot reload safe)
 * - Validar env vars
 * - Usar EXATAMENTE o bucket informado (inclusive .firebasestorage.app)
 * - Expor getAdminDb/getAdminAuth/getAdminBucket
 */

function stripQuotes(s: string) {
  return s.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
}

function getPrivateKey() {
  const raw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!raw) return null;

  const k = stripQuotes(String(raw)).replace(/\\n/g, "\n");
  return k.trim() ? k : null;
}

/**
 * ✅ Não converte firebasestorage.app -> appspot.com
 * Apenas limpa entradas erradas comuns (gs://, urls completas).
 */
function normalizeBucketName(input: string | null) {
  const v = stripQuotes(String(input || "")).trim();
  if (!v) return null;

  let b = v;

  // remove gs://
  if (b.startsWith("gs://")) b = b.slice("gs://".length);

  // se vier URL completa por engano, tenta extrair:
  // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/...
  const m = b.match(/\/b\/([^/]+)\/o\//);
  if (m?.[1]) b = m[1];

  return b.trim() || null;
}

function pickBucketFromEnv() {
  const raw =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.FIREBASE_ADMIN_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || // fallback (não ideal, mas evita quebrar)
    "";

  return normalizeBucketName(raw ? String(raw) : null);
}

/* ------------------ init ------------------ */

export function getAdminApp() {
  // Hot reload safe
  if (admin.apps.length) return admin.app();

  const projectId = String(process.env.FIREBASE_ADMIN_PROJECT_ID || "").trim();
  const clientEmail = String(process.env.FIREBASE_ADMIN_CLIENT_EMAIL || "").trim();
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing FIREBASE_ADMIN_* env vars (FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY)"
    );
  }

  const storageBucket = pickBucketFromEnv(); // ✅ aceita .firebasestorage.app

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    ...(storageBucket ? { storageBucket } : {}),
  });

  // ✅ evita crash se algum field for undefined
  try {
    admin.firestore().settings({ ignoreUndefinedProperties: true });
  } catch {}

  return admin.app();
}

/* ------------------ exports ------------------ */

export function getAdminDb() {
  getAdminApp();
  return admin.firestore();
}

export function getAdminAuth() {
  getAdminApp();
  return admin.auth();
}

export function getAdminBucket() {
  const app = getAdminApp();

  const fromApp = (app.options as any)?.storageBucket ? String((app.options as any).storageBucket) : "";
  const fromEnv =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.FIREBASE_ADMIN_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "";

  const bucketName = normalizeBucketName(fromApp || null) || normalizeBucketName(fromEnv ? String(fromEnv) : null);

  if (!bucketName) {
    throw new Error("Bucket name not specified. Set FIREBASE_STORAGE_BUCKET=<your-bucket>");
  }

  return admin.storage().bucket(bucketName);
}
