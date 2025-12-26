import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

export async function POST() {
  try {
    const uid = process.env.ADMIN_UID;

    if (!uid) {
      return NextResponse.json(
        { ok: false, error: "ADMIN_UID vazio no .env.local" },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    await db.collection("admins").doc(uid).set(
      { role: "admin", createdAt: new Date().toISOString() },
      { merge: true }
    );

    // confirma que existe
    const confirm = await db.collection("admins").doc(uid).get();
    return NextResponse.json({ ok: true, exists: confirm.exists, uid });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Erro no bootstrap" },
      { status: 500 }
    );
  }
}
