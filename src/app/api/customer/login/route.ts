import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { hashPin, signSession } from "@/lib/customerSession";

type Body = {
  phone: string;
  pin: string;
};

const normPhone = (s: string) => String(s || "").replace(/[^\d]/g, "");

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Partial<Body> | null;

    const phone = normPhone(body?.phone || "");
    const pin = String(body?.pin || "").trim();

    if (!phone || !pin) {
      return NextResponse.json({ ok: false, error: "Missing phone/pin" }, { status: 400 });
    }
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ ok: false, error: "PIN must be 4 digits" }, { status: 400 });
    }

    const db = getAdminDb();

    // ✅ pedido mais recente do telefone
    const snap = await db
      .collection("orders")
      .where("customer.phoneNorm", "==", phone)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json(
        { ok: false, error: "Nenhum pedido encontrado para este telefone" },
        { status: 404 }
      );
    }

    const doc = snap.docs[0];
    const data = doc.data() as any;

    const storedHash = String(data?.access?.pinHash || "").trim();
    if (!storedHash) {
      return NextResponse.json({ ok: false, error: "Pedido sem acesso configurado" }, { status: 400 });
    }

    if (hashPin(pin) !== storedHash) {
      return NextResponse.json({ ok: false, error: "PIN incorreto" }, { status: 401 });
    }

    const token = signSession({ orderId: doc.id, phone });

    const res = NextResponse.json({ ok: true, orderId: doc.id });

    // ✅ forma correta / estável de setar cookie no Route Handler
    res.cookies.set("cust_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    });

    return res;
  } catch (e: any) {
    // ajuda MUITO a debugar no terminal do Next
    console.error("customer/login error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Erro" }, { status: 500 });
  }
}
