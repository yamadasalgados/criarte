"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "denied" | "ok">("loading");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setStatus("denied");
        return;
      }

      try {
        const adminRef = doc(db, "admins", u.uid);
        const snap = await getDoc(adminRef);
        setStatus(snap.exists() ? "ok" : "denied");
      } catch (e) {
        // se der PERMISSION_DENIED, cai aqui
        setStatus("denied");
      }
    });

    return () => unsub();
  }, []);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-zinc-300">
        Carregando…
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
          <div className="text-lg font-semibold">Acesso negado</div>
          <div className="mt-2 text-sm text-zinc-300">
            Você precisa estar logado como Admin (documento <span className="font-mono">admins/{`{uid}`}</span>).
          </div>
          <a
            href="/admin/login"
            className="mt-4 inline-block rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
          >
            Ir para login
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
