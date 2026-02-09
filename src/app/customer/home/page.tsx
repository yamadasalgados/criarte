"use client";

import { useEffect, useMemo, useState } from "react";
import StoreNav from "@/components/StoreNav";
import { useRouter } from "next/navigation";
import { getLang, onLangChanged, t, type Lang } from "@/lib/i18n";
import { yen } from "@/lib/money";

// --- Tipagens ---

type Tone = "good" | "bad" | "neutral";

type CustomerSession = {
  customerId: string;
  phone?: string;
  at?: number;
};

type CustomerInfo = {
  id: string;
  name?: string | null;
  surname?: string | null;
  email?: string | null;
  phone?: string | null;
  phoneNorm?: string | null;
  address?: string | null;
  provider?: "google" | "phone" | string | null;
  createdAt?: any | null;
};

type OrderRow = {
  id: string;
  status: string;
  total: number;
  createdAt?: any | null;
  itemsSummary?: string | null;
  customerName?: string | null;
};

// --- Funções Auxiliares ---

function readCustomerSession(): CustomerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("customer_session_v1");
    if (!raw) return null;
    const j = JSON.parse(raw) as CustomerSession;
    if (!j?.customerId) return null;
    return j;
  } catch {
    return null;
  }
}

function formatDateAny(ts: any) {
  try {
    if (!ts) return "-";
    if (typeof ts?.toDate === "function")
      return ts.toDate().toISOString().slice(0, 16).replace("T", " ");
    if (ts instanceof Date)
      return ts.toISOString().slice(0, 16).replace("T", " ");
    if (typeof ts === "string") return ts.slice(0, 16).replace("T", " ");
    return "-";
  } catch {
    return "-";
  }
}

// ✅ Corrigido: Agora retorna explicitamente o tipo Tone
function statusMeta(status: string): { tone: Tone; key: any } {
  const s = String(status || "").toLowerCase().trim();
  if (s === "paid" || s === "confirmed" || s === "delivered") {
    return { tone: "good" as Tone, key: `status_${s}` };
  }
  if (s === "cancelled" || s === "canceled") {
    return { tone: "bad" as Tone, key: "status_cancelled" };
  }
  return { tone: "neutral" as Tone, key: "status_pending" };
}

// --- Componente Principal ---

export default function CustomerHomePage() {
  const router = useRouter();

  const [lang, setLangState] = useState<Lang>("pt");
  useEffect(() => {
    setLangState(getLang());
    const off = onLangChanged((l) => setLangState(l));
    return () => off();
  }, []);

  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string>("");
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [authMode, setAuthMode] = useState<"google" | "phone" | "none">("none");

  const headlineName = useMemo(() => {
    const full = [customer?.name, customer?.surname].filter(Boolean).join(" ").trim();
    if (full) return full;
    if (customer?.email) return customer.email;
    if (customer?.phone) return customer.phone;
    return t("cust_home_guest", lang);
  }, [customer, lang]);

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const totalSpent = orders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    const last = orders[0] || null;
    return { totalOrders, totalSpent, last };
  }, [orders]);

  // ✅ Corrigido: Tipagem do parâmetro tone
  const badgeClass = (tone: Tone) =>
    tone === "good"
      ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))/0.12] text-[rgb(var(--primary))]"
      : tone === "bad"
      ? "border-[rgb(var(--danger))] bg-[rgb(var(--danger))/0.10] text-[rgb(var(--danger))]"
      : "border-app bg-card text-muted";

  const fetchHome = async () => {
    setBusy(true);
    setErr("");

    try {
      const sess = readCustomerSession();
      if (sess?.customerId) {
        setAuthMode("phone");
        const res = await fetch(
          `/api/customer/orders?customerId=${encodeURIComponent(sess.customerId)}`
        );

        if (res.status === 401) {
          router.replace("/customer/login");
          return;
        }
        const data = await res.json();
        if (!data?.ok) throw new Error(data?.error || "Failed");

        setCustomer(data.customer || null);
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        return;
      }

      setAuthMode("google");
      const res = await fetch("/api/customer/orders");

      if (res.status === 401) {
        router.replace("/customer/login");
        return;
      }

      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Failed");

      setCustomer(data.customer || null);
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (e: any) {
      setErr(String(e?.message || "Erro"));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    fetchHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    setBusy(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("customer_session_v1");
      }
      await fetch("/api/customer/logout", { method: "POST" }).catch(() => {});
    } finally {
      setBusy(false);
      router.replace("/customer/login");
    }
  };

  return (
    <div className="bg-app text-app min-h-screen">
      <StoreNav />

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-app italic uppercase tracking-tighter">
              {t("cust_home_title", lang)}
            </h1>
            <p className="mt-1 text-sm text-muted">{t("cust_home_subtitle", lang)}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="btn-ghost rounded-xl px-3 py-2 text-sm font-semibold"
              onClick={() => router.push("/")}
            >
              {t("cust_home_shop", lang)}
            </button>

            <button
              className="btn-ghost rounded-xl px-3 py-2 text-sm font-semibold text-[rgb(var(--danger))]"
              onClick={logout}
              disabled={busy}
            >
              {t("cust_home_logout", lang)}
            </button>
          </div>
        </div>

        {busy ? (
          <div className="mt-6 rounded-2xl border border-app bg-card p-8 text-center animate-pulse">
             <div className="text-muted text-sm italic uppercase tracking-widest">Carregando...</div>
          </div>
        ) : err ? (
          <div className="mt-6 rounded-2xl border border-[rgb(var(--danger))] bg-card p-6 shadow-sm">
            <div className="text-sm font-black uppercase text-[rgb(var(--danger))]">
              {t("cust_home_error_title", lang)}
            </div>
            <div className="mt-2 text-sm text-muted">{err}</div>
            <button className="btn-primary mt-4 rounded-xl px-4 py-2 text-sm" onClick={fetchHome}>
              {t("cust_home_retry", lang)}
            </button>
          </div>
        ) : (
          <>
            {/* Perfil */}
            <div className="mt-6 rounded-2xl border border-app bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase font-black tracking-widest text-muted">{t("cust_home_welcome", lang)}</div>
                  <div className="mt-1 text-2xl font-black text-app italic">{headlineName}</div>
                </div>
                <button
                  className="btn-primary rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest"
                  onClick={() => router.push("/customer/orders")}
                >
                  {t("cust_home_open_history", lang)}
                </button>
              </div>

              {/* Stats */}
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-app bg-card-muted p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted">{t("cust_home_stat_orders", lang)}</div>
                  <div className="mt-1 text-xl font-black text-app">{stats.totalOrders}</div>
                </div>
                <div className="rounded-2xl border border-app bg-card-muted p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted">{t("cust_home_stat_spent", lang)}</div>
                  <div className="mt-1 text-xl font-black text-primary italic">{yen(stats.totalSpent)}</div>
                </div>
                <div className="rounded-2xl border border-app bg-card-muted p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted">{t("cust_home_stat_last", lang)}</div>
                  <div className="mt-1 text-sm font-bold text-app truncate">
                    {stats.last ? `#${stats.last.id.slice(0, 8)}` : "-"}
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de Pedidos */}
            <div className="mt-8">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted mb-4 px-1">
                {t("cust_home_recent_title", lang)}
              </h2>

              {orders.length === 0 ? (
                <div className="rounded-2xl border border-app bg-card p-12 text-center">
                  <div className="text-muted text-sm">{t("cust_home_empty_text", lang)}</div>
                </div>
              ) : (
                <div className="grid gap-4">
                  {orders.slice(0, 5).map((o) => {
                    const meta = statusMeta(o.status);
                    return (
                      <div key={o.id} className="rounded-2xl border border-app bg-card p-5 shadow-sm hover:border-primary/50 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold font-mono opacity-50">#{o.id.slice(0, 8)}</span>
                          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${badgeClass(meta.tone)}`}>
                            {t(meta.key, lang)}
                          </span>
                        </div>
                        
                        <div className="flex items-end justify-between">
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-muted mb-1">
                              {formatDateAny(o.createdAt)}
                            </div>
                            <div className="text-lg font-black text-app italic">{yen(o.total)}</div>
                          </div>
                          
                          <button
                            className="btn-primary rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest"
                            onClick={() => router.push(`/customer/chat?orderId=${encodeURIComponent(o.id)}`)}
                          >
                            {t("cust_home_open_chat", lang)}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}