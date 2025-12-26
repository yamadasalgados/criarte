"use client";

import { useEffect, useState } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("admin@criaarte.jp");
  const [password, setPassword] = useState("CriaArte#2025");
  const [busy, setBusy] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  const login = async () => {
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      window.location.href = "/admin";
    } catch (e: any) {
      alert(e?.message || "Erro no login");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-app text-app min-h-screen">
      <div className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl font-bold text-app">Login Admin</h1>
        <p className="mt-1 text-sm text-muted">Acesse o painel administrativo.</p>

        <div className="mt-6 grid gap-3 rounded-2xl border border-app bg-card p-4 shadow-sm">
          <label className="text-sm text-app">
            Email
            <input
              className="input mt-1 w-full rounded-xl px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>

          <label className="text-sm text-app">
            Senha
            <input
              type="password"
              className="input mt-1 w-full rounded-xl px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          <button
            disabled={busy}
            onClick={login}
            className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Entrando…" : "Entrar"}
          </button>

          {uid ? (
            <div className="mt-3 rounded-xl border border-app bg-card-muted p-3">
              <div className="text-xs text-muted">Você está logado. UID:</div>
              <div className="mt-1 font-mono text-xs text-app break-all">{uid}</div>
              <a href="/admin" className="btn-ghost mt-3 inline-block rounded-xl px-3 py-2 text-sm">
                Ir para /admin
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
