import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import admin from "firebase-admin";
import crypto from "crypto";

import { getAdminAuth, getAdminBucket, getAdminDb } from "@/lib/firebaseAdmin";
import { verifySession, hashPin } from "@/lib/customerSession";

/* ------------------ helpers ------------------ */

function normalizeStatus(s: any) {
  const v = String(s || "").toLowerCase().trim();
  return v || "pending";
}

function normalizePhoneLoose(p: any) {
  return String(p || "").replace(/[^\d]/g, "");
}

function pickCustomText(it: any): string {
  const candidates = [
    it?.customText,
    it?.note,
    it?.customization,
    it?.customizationNote,
    it?.personalizacao,
    it?.personalizacaoDescricao,
    it?.personalization,
    it?.personalizationNote,
  ];

  return (
    candidates
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean)[0] || ""
  );
}

function buildItemsSummary(order: any) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const parts = items
    .map((it: any) => {
      const name = String(it?.nameSnapshot || it?.name || "").trim();
      const qty = Number(it?.qty || 0);
      if (!name) return null;

      const custom = pickCustomText(it);
      const base = Number.isFinite(qty) && qty > 0 ? `${name} x${qty}` : name;

      return custom ? `${base} (${custom})` : base;
    })
    .filter(Boolean) as string[];

  return parts.join(", ");
}

async function getSessionFromCookie() {
  const jar = await cookies();
  const token = jar.get("cust_session")?.value || null;
  return verifySession(token); // { orderId, phone } | null
}

/**
 * ✅ Admin auth: Bearer token com claim admin=true
 * Se isso retornar null, o request é tratado como CLIENTE.
 */
async function getAdminFromAuthHeader(req: Request): Promise<{ uid: string } | null> {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  const idToken = m[1].trim();
  if (!idToken) return null;

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken, true);

    // ⚠️ GARANTE claim admin
    if (decoded?.admin === true) return { uid: decoded.uid };
    return null;
  } catch (e) {
    console.warn("[messages] invalid admin bearer token");
    return null;
  }
}

function assertCustomerOwnsOrderOrThrow(opts: { order: any; sessionPhone: string }) {
  const { order, sessionPhone } = opts;

  const phoneSessNorm = normalizePhoneLoose(sessionPhone);
  if (!phoneSessNorm) throw new Error("Forbidden");

  const orderPhoneHash =
    typeof order?.customer?.phoneHash === "string" ? order.customer.phoneHash.trim() : "";

  if (orderPhoneHash) {
    const sessHash = hashPin(phoneSessNorm);
    if (sessHash !== orderPhoneHash) throw new Error("Forbidden");
    return;
  }

  const orderPhone = normalizePhoneLoose(order?.customer?.phone || order?.customerPhone || order?.phone || "");
  if (orderPhone && orderPhone !== phoneSessNorm) throw new Error("Forbidden");
}

/* ------------------ image helpers ------------------ */

class ImageTooLargeError extends Error {
  status = 413;
  constructor(message: string) {
    super(message);
    this.name = "ImageTooLargeError";
  }
}

function getMaxImageBytes() {
  const mb = Number(process.env.MAX_CHAT_IMAGE_MB || 8);
  const safeMb = Number.isFinite(mb) && mb > 0 ? mb : 8;
  return Math.floor(safeMb * 1024 * 1024);
}

function parseDataUrlImage(dataUrl: string): { contentType: string; buffer: Buffer; ext: string } {
  const s = String(dataUrl || "").trim();
  const m = s.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) throw new Error("Formato de imagem inválido");

  const contentType = m[1].toLowerCase();
  const b64 = m[2];

  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(contentType)) throw new Error("Tipo de imagem não permitido");

  const buffer = Buffer.from(b64, "base64");

  const MAX_BYTES = getMaxImageBytes();
  if (buffer.length > MAX_BYTES) {
    const mb = (MAX_BYTES / (1024 * 1024)).toFixed(0);
    throw new ImageTooLargeError(`Imagem muito grande (máx ${mb}MB). Comprima antes de enviar.`);
  }

  const ext =
    contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
      ? "webp"
      : contentType.includes("gif")
      ? "gif"
      : "jpg";

  return { contentType, buffer, ext };
}

async function uploadMessageImage(opts: {
  orderId: string;
  messageId: string;
  imageDataUrl: string;
}): Promise<{ imageUrl: string; imagePath: string }> {
  const { orderId, messageId, imageDataUrl } = opts;

  const { contentType, buffer, ext } = parseDataUrlImage(imageDataUrl);

  const bucket = getAdminBucket();
  const token = crypto.randomUUID();

  const imagePath = `orders/${orderId}/messages/${messageId}.${ext}`;
  const file = bucket.file(imagePath);

  console.log("[messages] upload bucket:", bucket.name);
  console.log("[messages] upload path:", imagePath);
  console.log("[messages] bytes:", buffer.length);

  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      metadata: { firebaseStorageDownloadTokens: token },
      cacheControl: "public, max-age=31536000",
    },
  });

  const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
    imagePath
  )}?alt=media&token=${token}`;

  return { imageUrl, imagePath };
}

/* ------------------ GET ------------------ */

export async function GET(req: Request) {
  try {
    const adminSender = await getAdminFromAuthHeader(req);
    const sess = await getSessionFromCookie();

    if (!adminSender && !sess) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(req.url);

    // ✅ Cliente: orderId SEMPRE da sessão
    // ✅ Admin: orderId via ?orderId=...
    const orderId = adminSender
      ? String(url.searchParams.get("orderId") || "").trim()
      : String(sess?.orderId || "").trim();

    if (!orderId) return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });

    console.log(
      `[messages] GET mode=${adminSender ? "admin" : "customer"} orderId=${orderId}${
        adminSender ? ` adminUid=${adminSender.uid}` : ""
      }`
    );

    const db = getAdminDb();
    const orderRef = db.collection("orders").doc(orderId);

    const [orderSnap, msgsSnap] = await Promise.all([
      orderRef.get(),
      orderRef.collection("messages").orderBy("createdAt", "asc").limit(300).get(),
    ]);

    if (!orderSnap.exists) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

    const order = orderSnap.data() as any;

    if (!adminSender && sess?.phone) {
      try {
        assertCustomerOwnsOrderOrThrow({ order, sessionPhone: sess.phone });
      } catch {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const itemsSummary = String(order?.itemsSummary || "").trim() || buildItemsSummary(order) || "Itens do pedido";

    const items = (Array.isArray(order?.items) ? order.items : []).map((it: any) => ({
      nameSnapshot: String(it?.nameSnapshot || "").trim(),
      name: String(it?.name || "").trim(),
      qty: Number.isFinite(Number(it?.qty || 0)) ? Number(it?.qty || 0) : 0,
      customText: pickCustomText(it) || "",
    }));

    const orderInfo = {
      id: orderSnap.id,
      status: normalizeStatus(order?.status),
      itemsSummary,
      items,
      total: Number(order?.totals?.revenue || 0),
      customerName: String(order?.customer?.name || "").trim(),
      createdAt: order?.createdAt || null,
      paidAt: order?.paidAt || null,
      deliveredAt: order?.deliveredAt || null,
    };

    const messages = msgsSnap.docs.map((d) => {
      const m = d.data() as any;
      return {
        id: d.id,
        senderRole: m?.senderRole === "admin" ? "admin" : "customer",
        text: String(m?.text || ""),
        imageUrl: typeof m?.imageUrl === "string" ? m.imageUrl : null,
        createdAt: m?.createdAt || null,
      };
    });

    return NextResponse.json({ ok: true, order: orderInfo, messages });
  } catch (e: any) {
    console.error("customer/messages GET error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Erro" }, { status: 500 });
  }
}

/* ------------------ POST ------------------ */

export async function POST(req: Request) {
  try {
    const adminSender = await getAdminFromAuthHeader(req);
    const sess = await getSessionFromCookie();

    if (!adminSender && !sess) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as
      | { text?: string; imageDataUrl?: string | null; orderId?: string }
      | null;

    const text = String(body?.text || "").trim().slice(0, 2000);
    const imageDataUrl = body?.imageDataUrl ? String(body.imageDataUrl).trim() : "";

    if (!text && !imageDataUrl) {
      return NextResponse.json({ ok: false, error: "Missing text or image" }, { status: 400 });
    }

    /**
     * ✅ CRÍTICO:
     * - Se for ADMIN: orderId TEM que vir no body
     * - Se for CUSTOMER: orderId vem só da sessão
     */
    const orderId = adminSender
      ? String(body?.orderId || "").trim()
      : String(sess?.orderId || "").trim();

    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: adminSender ? "Missing orderId" : "Not authenticated" },
        { status: adminSender ? 400 : 401 }
      );
    }

    console.log(
      `[messages] POST mode=${adminSender ? "admin" : "customer"} orderId=${orderId}${
        adminSender ? ` adminUid=${adminSender.uid}` : ""
      }`
    );

    const db = getAdminDb();
    const orderRef = db.collection("orders").doc(orderId);

    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

    const order = orderSnap.data() as any;

    if (!adminSender && sess?.phone) {
      try {
        assertCustomerOwnsOrderOrThrow({ order, sessionPhone: sess.phone });
      } catch {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const msgRef = orderRef.collection("messages").doc();
    const messageId = msgRef.id;

    let imageUrl: string | null = null;
    let imagePath: string | null = null;

    if (imageDataUrl) {
      const up = await uploadMessageImage({ orderId, messageId, imageDataUrl });
      imageUrl = up.imageUrl;
      imagePath = up.imagePath;
    }

    await Promise.all([
      msgRef.set({
        senderRole: adminSender ? "admin" : "customer",
        senderId: adminSender ? adminSender.uid : null,
        text: text || "",
        imageUrl: imageUrl || null,
        imagePath: imagePath || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
      orderRef.set({ updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.name === "ImageTooLargeError" && typeof e?.status === "number") {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }

    console.error("customer/messages POST error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Erro" }, { status: 500 });
  }
}
