import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import admin from "firebase-admin";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer (.+)$/i);
  return m?.[1] || "";
}

async function requireAdmin(req: Request) {
  const token = getBearer(req);
  if (!token) throw new Error("Missing Authorization Bearer token");

  const decoded = await admin.auth().verifyIdToken(token);
  if (!decoded?.admin) throw new Error("Not admin");
  return decoded;
}

// ✅ Next 16.1+ pode entregar params como Promise
type Ctx = {
  params: Promise<{ id: string }> | { id: string };
};

async function getOrderId(ctx: Ctx) {
  const p = await Promise.resolve(ctx.params as any);
  return String(p?.id || "").trim();
}

/** Monta um resumo com nomes e quantidades: "Coxinha x2, Kibe x1" */
function buildItemsSummary(order: any) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const parts = items
    .map((it: any) => {
      const name = String(it?.nameSnapshot || it?.name || "").trim();
      const qty = Number(it?.qty || 0);
      if (!name) return null;

      if (!Number.isFinite(qty) || qty <= 0) return name;
      return `${name} x${qty}`;
    })
    .filter(Boolean) as string[];

  return parts.join(", ");
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    await requireAdmin(req);

    const orderId = await getOrderId(ctx);
    if (!orderId) {
      return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });
    }

    const db = getAdminDb();

    const orderRef = db.collection("orders").doc(orderId);
    const moveRef = db.collection("cash_movements").doc(`order_${orderId}`);

    await db.runTransaction(async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) throw new Error("Order not found");

      const order = orderSnap.data() as any;

      // Se já está pago, não faz nada (idempotente)
      if (order?.status === "paid") return;

      const amount = Number(order?.totals?.revenue || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Invalid order totals.revenue");
      }

      // ✅ cria resumo com nomes dos produtos (do snapshot do pedido)
      const itemsSummary = buildItemsSummary(order);

      // cria movimento (se já existir, mantém)
      const moveSnap = await tx.get(moveRef);
      if (!moveSnap.exists) {
        tx.set(moveRef, {
          type: "in",
          category: "sale",
          amount,

          // ✅ linha 2 do extrato pode usar isso:
          itemsSummary,

          // ✅ note mais humano (se tiver produtos)
          note: itemsSummary ? `Venda: ${itemsSummary}` : `Venda do pedido ${orderId}`,

          orderId,
          occurredAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      tx.update(orderRef, {
        status: "paid",
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ ok: true, orderId });
  } catch (e: any) {
    // mantém seu comportamento (401), mas se quiser posso refinar status depois
    return NextResponse.json({ ok: false, error: e?.message || "Erro" }, { status: 401 });
  }
}
