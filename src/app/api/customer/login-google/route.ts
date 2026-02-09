import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

type Body = { idToken: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Partial<Body> | null;
    const idToken = String(body?.idToken || "").trim();

    if (!idToken) {
      return NextResponse.json({ ok: false, error: "Missing idToken" }, { status: 400 });
    }

    const auth = getAdminAuth();

    // checkRevoked=true é ok, mas se der qualquer instabilidade no Android,
    // depois podemos mudar pra false. Por enquanto mantém.
    const decoded = await auth.verifyIdToken(idToken, true);

    const uid = decoded.uid;
    const email = typeof decoded.email === "string" ? decoded.email : null;
    const name = typeof decoded.name === "string" ? decoded.name : "";
    const picture = typeof decoded.picture === "string" ? decoded.picture : null;

    const db = getAdminDb();
    const ref = db.collection("customers").doc(uid);

    // ✅ não reseta createdAt a cada login
    const snap = await ref.get();
    const isNew = !snap.exists;

    const payload: any = {
      uid,
      email,
      name,
      photoURL: picture,
      provider: "google",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (isNew) {
      payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await ref.set(payload, { merge: true });

    return NextResponse.json({ ok: true, uid });
  } catch (e: any) {
    console.error("login-google error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Erro" }, { status: 500 });
  }
}
