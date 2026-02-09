"use client";

import StoreNav from "@/components/StoreNav";
import { auth, db } from "@/lib/firebaseClient";
import { yen } from "@/lib/money";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type OrderRow = {
  id: string;
  status: string;
  createdAt?: any | null;
  totals?: { revenue?: number; cost?: number; profit?: number };
  customer?: { name?: string; phone?: string };
  items?: Array<{ nameSnapshot?: string; qty?: number; customText?: string }>;
};

function formatDateAny(ts: any) {
  try {
    if (!ts) return "-";
    if (typeof ts?.toDate === "function")
      return ts.toDate().toISOString().slice(0, 16).replace("T", " ");
    if (ts instanceof Date)
      return ts.toISOString().slice(0, 16).replace("T", " ");
    return "-";
  } catch {
    return "-";
  }
}

function statusTone(status: string) {
  const s = String(status || "").toLowerCase().trim();
  if (s === "paid" || s === "confirmed" || s === "delivered") return "good";
  if (s === "cancelled" || s === "canceled") return "bad";
  return "neutral";
}

export default function CustomerOrdersPage() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      setAuthReady(true);

      if (!u) {
        setUid("");
        setEmail("");
        setOrders([]);
        setLoading(false);
        router.replace("/customer/login");
        return;
      }

      setUid(u.uid);
      setEmail(u.email || "");
    });

    return () => off();
  }, [router]);

  useEffect(() => {
    if (!uid) return;

    setLoading(true);
    setErr("");

    // ✅ orders vinculados ao cliente logado
    const q = query(
      collection(db, "orders"),
      where("customer.auth.uid", "==", uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: OrderRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as DocumentData;
          rows.push({
            id: d.id,
            status: String(data?.status || "pending"),
            createdAt: data?.createdAt || null,
            totals: data?.totals || {},
            customer: data?.customer || {},
            items: Array.isArray(data?.items) ? data.items : [],
          });
        });

        setOrders(rows);
        setLoading(false);
      },
      (e) => {
        setErr(String(e?.message || "Falha ao carregar pedidos"));
        setOrders([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  const header = useMemo(() => {
    return email ? `(${email})` : uid ? `(${uid.slice(0, 10)}...)` : "";
  }, [uid, email]);

  if (!authReady) {
    return (
      <div className="bg-app text-app min-h-screen">
        <StoreNav />
        <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted">
          Carregando...
        </main>
      </div>
    );
  }

  return (
    <div className="bg-app text-app min-h-screen">
      <StoreNav />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-app">Histórico de Compras</h1>
            <p className="mt-1 text-sm text-muted">
              Seus pedidos {header ? <span className="font-mono">{header}</span> : null}
            </p>
          </div>

          <button
            className="btn-ghost rounded-xl px-3 py-2 text-sm"
            onClick={() => router.push("/chat")}
          >
            Ir para o Chat
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-app bg-card p-4 shadow-sm">
          {loading ? (
            <div className="text-sm text-muted">Carregando pedidos...</div>
          ) : err ? (
            <div className="text-sm text-[rgb(var(--danger))]">{err}</div>
          ) : orders.length === 0 ? (
            <div className="text-sm text-muted">
              Nenhum pedido ainda. Faça sua primeira compra e ela aparecerá aqui.
            </div>
          ) : (
            <div className="grid gap-3">
              {orders.map((o) => {
                const tone = statusTone(o.status);
                const badge =
                  tone === "good"
                    ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))/0.12] text-[rgb(var(--primary))]"
                    : tone === "bad"
                    ? "border-[rgb(var(--danger))] bg-[rgb(var(--danger))/0.10] text-[rgb(var(--danger))]"
                    : "border-app bg-card text-muted";

                const total = Number(o?.totals?.revenue || 0);

                const summary =
                  (o.items || [])
                    .slice(0, 3)
                    .map((it) => {
                      const n = String(it?.nameSnapshot || "Item");
                      const q = Number(it?.qty || 0);
                      return q ? `${n} x${q}` : n;
                    })
                    .filter(Boolean)
                    .join(" • ") || "Itens do pedido";

                return (
                  <button
                    key={o.id}
                    onClick={() => router.push(`/chat?orderId=${encodeURIComponent(o.id)}`)}
                    className="text-left rounded-2xl border border-app bg-card-muted p-4 hover:bg-card transition"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-app">
                        Pedido <span className="font-mono">#{o.id.slice(0, 8)}</span>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badge}`}>
                        {o.status}
                      </span>
                    </div>

                    <div className="mt-2 text-sm text-muted">{summary}</div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-muted">
                        Criado em: <span className="font-mono">{formatDateAny(o.createdAt)}</span>
                      </div>
                      <div className="text-lg font-bold text-[rgb(var(--primary))]">
                        {yen(total)}
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-muted">
                      Clique para abrir o chat deste pedido.
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
