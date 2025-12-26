"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebaseClient";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function Navbar() {
  const [uid, setUid] = useState<string | null>(null);
  const [claimsAdmin, setClaimsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUid(u?.uid ?? null);
      if (!u) {
        setClaimsAdmin(null);
        return;
      }

      // ✅ força refresh do ID token pra puxar claims novas
      const tok = await u.getIdTokenResult(true);
      setClaimsAdmin(tok?.claims?.admin === true);
    });

    return () => unsub();
  }, []);

  const logout = async () => {
    await signOut(auth);
    window.location.href = "/admin/login";
  };

  return (
    <div className="sticky top-0 z-10 border-b border-app bg-[rgb(var(--panel2))/0.92] backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/admin" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="CriArte" className="h-10 w-auto rounded-lg" />
        </Link>

        <div className="flex items-center gap-4 text-sm text-muted">
          <Link href="/admin/products" className="hover:text-app">
            Produtos
          </Link>
          <Link href="/admin/orders" className="hover:text-app">
            Pedidos
          </Link>
          <Link href="/admin/cashflow" className="hover:text-app">
            Caixa
          </Link>
          <Link href="/" className="hover:text-app">
            Loja
          </Link>

          {uid ? (
            <span className="hidden sm:inline text-xs text-muted">
              admin claim:{" "}
              <b className={claimsAdmin ? "text-[rgb(var(--primary))]" : "text-[rgb(var(--danger))]"}>
                {claimsAdmin ? "true" : "false"}
              </b>
            </span>
          ) : null}

          {uid ? (
            <button
              onClick={logout}
              className="rounded-xl border border-app bg-card px-3 py-2 text-sm text-app hover:brightness-110"
            >
              Sair
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
