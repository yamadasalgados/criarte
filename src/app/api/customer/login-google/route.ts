import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { signSession } from "@/lib/customerSession";

type Body = { idToken: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Partial<Body> | null;
    const idToken = String(body?.idToken || "").trim();
    if (!idToken) return NextResponse.json({ ok: false, error: "Missing idToken" }, { status: 400 });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = String(decoded?.uid || "").trim();
    if (!uid) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });

    const db = getAdminDb();

    // ✅ acha o pedido mais recente desse uid (salvo no checkout)
    const snap = await db
      .collection("orders")
      .where("customer.auth.uid", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json(
        { ok: false, error: "Nenhum pedido encontrado para esta conta Google" },
        { status: 404 }
      );
    }

    const doc = snap.docs[0];
    const order = doc.data() as any;

    const phone = String(order?.customer?.phoneNorm || "").replace(/[^\d]/g, "");
    if (!phone) {
      return NextResponse.json({ ok: false, error: "Pedido sem phoneNorm" }, { status: 400 });
    }

    const token = signSession({ orderId: doc.id, phone });

    const res = NextResponse.json({ ok: true, orderId: doc.id });
    res.cookies.set("cust_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (e: any) {
    console.error("customer/login-google error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Erro" }, { status: 500 });
  }
}
