import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { hashPin, signSession } from "@/lib/customerSession";

type Body = {
  phone: string;
  pin: string;
  orderId?: string; // ✅ novo
};

function normalizePhoneJPServer(input: any) {
  let d = String(input || "").replace(/[^\d]/g, "");
  if (!d) return "";
  if (d.startsWith("81") && d.length >= 10) d = "0" + d.slice(2);
  return d;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Partial<Body> | null;

    const phone = normalizePhoneJPServer(body?.phone);
    const pin = String(body?.pin || "").trim();
    const orderId = String(body?.orderId || "").trim(); // ✅

    if (!phone || !pin) {
      return NextResponse.json({ ok: false, error: "Missing phone/pin" }, { status: 400 });
    }
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ ok: false, error: "PIN must be 4 digits" }, { status: 400 });
    }

    const db = getAdminDb();

    // ✅ Se vier orderId: valida exatamente aquele pedido
    // ✅ Senão: cai no comportamento antigo (último pedido)
    let docId = "";
    let data: any = null;

    if (orderId) {
      const ref = db.collection("orders").doc(orderId);
      const snap = await ref.get();
      if (!snap.exists) {
        return NextResponse.json({ ok: false, error: "Pedido não encontrado" }, { status: 404 });
      }
      data = snap.data();
      docId = snap.id;

      const orderPhone = normalizePhoneJPServer(
        data?.customerPhoneNorm || data?.customer?.phoneNorm || data?.customer?.phone || ""
      );

      if (!orderPhone || orderPhone !== phone) {
        return NextResponse.json({ ok: false, error: "Telefone não confere com o pedido" }, { status: 403 });
      }
    } else {
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

      docId = snap.docs[0].id;
      data = snap.docs[0].data();
    }

    const storedHash = String(data?.access?.pinHash || "").trim();
    if (!storedHash) {
      return NextResponse.json({ ok: false, error: "Pedido sem acesso configurado" }, { status: 400 });
    }

    if (hashPin(pin) !== storedHash) {
      return NextResponse.json({ ok: false, error: "PIN incorreto" }, { status: 401 });
    }

    // ✅ cookie amarrado ao orderId correto
    const token = signSession({ orderId: docId, phone });

    const res = NextResponse.json({ ok: true, orderId: docId, phone });

    res.cookies.set("cust_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (e: any) {
    console.error("customer/login error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Erro" }, { status: 500 });
  }
}
