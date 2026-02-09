"use client";

import { useEffect, useState } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      // Se já estiver logado, podemos redirecionar automaticamente
      if (u) {
        // router.push("/admin"); // Opcional: auto-redirecionar
      }
    });
    return () => unsub();
  }, [router]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault(); // Previne o reload da página
    if (!email || !password) return;

    setBusy(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push("/admin");
    } catch (e: any) {
      console.error("Erro de login:", e.code);
      // Mensagens amigáveis em vez de alertas brutos
      if (e.code === "auth/invalid-credential") {
        setError("E-mail ou senha incorretos.");
      } else if (e.code === "auth/too-many-requests") {
        setError("Muitas tentativas. Tente novamente mais tarde.");
      } else {
        setError("Ocorreu um erro ao acessar a conta.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUid(null);
  };

  return (
    <div className="bg-app text-app min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-app">Backstage</h1>
          <p className="mt-2 text-sm text-muted">Painel Administrativo</p>
        </div>

        <form 
          onSubmit={login}
          className="grid gap-4 rounded-3xl border border-app bg-card p-6 shadow-lg"
        >
          <div className="space-y-4">
            <label className="block text-sm font-medium text-app">
              Email
              <input
                type="email"
                required
                className="input mt-1 w-full rounded-xl px-4 py-3 bg-app border-app focus:ring-2 ring-[rgb(var(--primary))]/20"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
              />
            </label>

            <label className="block text-sm font-medium text-app">
              Senha
              <input
                type="password"
                required
                className="input mt-1 w-full rounded-xl px-4 py-3 bg-app border-app focus:ring-2 ring-[rgb(var(--primary))]/20"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>
          </div>

          {error && (
            <div className="rounded-xl bg-[rgb(var(--danger))/0.1] p-3 text-sm text-[rgb(var(--danger))] border border-[rgb(var(--danger))/0.2]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full rounded-xl py-3 font-bold text-lg shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "Autenticando..." : "Entrar no Painel"}
          </button>

          {uid && (
            <div className="mt-4 pt-4 border-t border-app">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Logado como</p>
                  <p className="text-xs font-mono text-app truncate">{uid}</p>
                </div>
                <button 
                  type="button"
                  onClick={handleLogout}
                  className="text-xs text-[rgb(var(--danger))] hover:underline"
                >
                  Sair
                </button>
              </div>
              <a 
                href="/admin" 
                className="btn-ghost mt-4 w-full block text-center rounded-xl py-2 text-sm font-semibold"
              >
                Acessar Dashboard →
              </a>
            </div>
          )}
        </form>
        
        <p className="mt-8 text-center text-xs text-muted">
          &copy; 2026 Weekend Loop Backstage. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}