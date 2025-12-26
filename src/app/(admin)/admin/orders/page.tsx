"use client";

import AdminGuard from "@/components/AdminGuard";
import Navbar from "@/components/Navbar";
import { auth, db } from "@/lib/firebaseClient";
import { yen } from "@/lib/money";
import { collection, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";

type OrderRow = {
  id: string;
  status: "pending" | "paid" | "cancelled" | "delivered";
  createdAt?: Timestamp;
  totals?: { revenue: number; cost: number; profit: number };
  customer?: { name: string; phone: string };

  customizationText?: string;
  items?: Array<{
    customText: any;
    name?: string;
    qty?: number;
    note?: string;
    customization?: string;
    customizationNote?: string;
    personalizacao?: string;
    personalizacaoDescricao?: string;
  }>;

  note?: string;
  notes?: string;
  personalization?: string;
  personalizationNote?: string;
  personalizacao?: string;
  personalizacaoDescricao?: string;
};

function StatusBadge({ status }: { status: OrderRow["status"] }) {
  const s = String(status || "pending").toLowerCase().trim();

  // ✅ tokens do tema
  const map: Record<string, string> = {
    pending: "border-[rgb(var(--warning))] bg-[rgb(var(--warning))/0.10] text-[rgb(var(--warning))]",
    paid: "border-[rgb(var(--primary))] bg-[rgb(var(--primary))/0.10] text-[rgb(var(--primary))]",
    delivered: "border-[rgb(var(--info))] bg-[rgb(var(--info))/0.10] text-[rgb(var(--info))]",
    cancelled: "border-[rgb(var(--danger))] bg-[rgb(var(--danger))/0.10] text-[rgb(var(--danger))]",
  };

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
        map[s] || "border-app bg-card text-muted"
      }`}
    >
      {s}
    </span>
  );
}

// ✅ Helper para pegar a “descrição de personalização” de forma robusta
function getCustomizationSummary(o: OrderRow): string {
  const directCandidates = [
    o.customizationText,
    o.personalization,
    o.personalizationNote,
    o.personalizacao,
    o.personalizacaoDescricao,
    o.note,
    o.notes,
  ]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);

  if (directCandidates.length > 0) return directCandidates[0];

  if (Array.isArray(o.items) && o.items.length > 0) {
    const lines = o.items
      .map((it) => {
        const name = typeof it.name === "string" ? it.name.trim() : "";
        const qty = typeof it.qty === "number" && Number.isFinite(it.qty) ? it.qty : null;

        const noteCandidates = [
          it.customText,
          it.note,
          it.customization,
          it.customizationNote,
          it.personalizacao,
          it.personalizacaoDescricao,
        ]
          .map((v) => (typeof v === "string" ? v.trim() : ""))
          .filter(Boolean);

        const note = noteCandidates[0] || "";
        if (!note) return "";

        const prefixParts: string[] = [];
        if (name) prefixParts.push(name);
        if (qty != null) prefixParts.push(`x${qty}`);

        const prefix = prefixParts.length > 0 ? `${prefixParts.join(" ")}: ` : "";
        return `${prefix}${note}`;
      })
      .filter(Boolean);

    if (lines.length > 0) return lines.join(" • ");
  }

  return "";
}

export default function AdminOrdersPage() {
  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const qy = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const snap = await getDocs(qy);
    setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const markPaid = async (orderId: string) => {
    if (!confirm("Confirmar que este pedido foi PAGO?")) return;
    setBusyId(orderId);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Admin não logado");

      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/orders/${orderId}/mark-paid`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Falha");

      await load();
    } catch (e: any) {
      alert(e?.message || "Erro ao marcar como pago");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminGuard>
      <div className="bg-app text-app min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-6">
          <h1 className="text-2xl font-bold text-app">Pedidos</h1>

          <div className="mt-2 text-sm text-muted">
            {loading ? "Carregando…" : `${items.length} pedido(s)`}
          </div>

          <div className="mt-4 grid gap-3">
            {items.map((o) => {
              const customizationSummary = getCustomizationSummary(o);

              // ✅ AQUI estava o erro: agora definimos as linhas dentro do map
              const customizationLines = customizationSummary
                .split(/•|\n/)
                .map((l) => l.trim())
                .filter(Boolean);

              return (
                <div key={o.id} className="rounded-2xl border border-app bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-app">
                        Pedido:{" "}
                        <span className="font-mono text-sm text-muted break-all">{o.id}</span>
                      </div>

                      <div className="mt-1 text-sm text-muted">
                        Cliente: <b className="text-app">{o.customer?.name || "-"}</b> •{" "}
                        {o.customer?.phone || "-"}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusBadge status={o.status} />
                        {o.createdAt && (
                          <span className="text-xs text-muted">
                            {o.createdAt.toDate().toLocaleString()}
                          </span>
                        )}
                      </div>

                      {customizationSummary && (
                        <div className="mt-2 rounded-xl border border-app bg-card-muted px-3 py-2">
                          <div className="text-[11px] font-semibold text-muted">
                            Personalização / Observações
                          </div>

                          <div className="mt-1 space-y-1 text-sm text-app">
                            {customizationLines.map((line, idx) => (
                              <div key={idx} className="break-words">
                                • <b>{line}</b>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-sm text-muted">
                        Total:{" "}
                        <b className="text-lg text-app">{yen(o.totals?.revenue || 0)}</b>
                      </div>

                      <div className="mt-2 flex gap-2 justify-end">
                        <a
                          href={`/admin/orders/${o.id}`}
                          className="btn-ghost rounded-xl px-3 py-1.5 text-sm"
                        >
                          Abrir
                        </a>

                        {o.status === "pending" && (
                          <button
                            disabled={busyId === o.id}
                            onClick={() => markPaid(o.id)}
                            className="rounded-xl bg-[rgb(var(--primary))] px-3 py-1.5 text-sm font-semibold text-[rgb(var(--panel2))] hover:brightness-110 disabled:opacity-60"
                          >
                            {busyId === o.id ? "Processando…" : "Marcar como pago"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {!loading && items.length === 0 && (
              <div className="rounded-xl border border-app bg-card p-4 text-muted">
                Nenhum pedido ainda.
              </div>
            )}
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}
