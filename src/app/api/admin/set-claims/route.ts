import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export async function POST() {
  try {
    const uid = process.env.ADMIN_UID;
    if (!uid) {
      return NextResponse.json({ ok: false, error: "ADMIN_UID vazio no .env.local" }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    await adminAuth.setCustomUserClaims(uid, { admin: true });

    return NextResponse.json({ ok: true, uid, claims: { admin: true } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erro ao setar claims" }, { status: 500 });
  }
}
