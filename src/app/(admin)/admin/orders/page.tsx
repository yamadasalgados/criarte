"use client";

import AdminGuard from "@/components/AdminGuard";
import Navbar from "@/components/Navbar";
import { auth, db } from "@/lib/firebaseClient";
import { yen } from "@/lib/money";
import { 
  collection, 
  getDocs, 
  orderBy, 
  query, 
  Timestamp, 
  doc, 
  writeBatch, 
  serverTimestamp,
  addDoc
} from "firebase/firestore";
import { useEffect, useState } from "react";

type OrderRow = {
  id: string;
  status: "pending" | "paid" | "cancelled" | "delivered";
  createdAt?: Timestamp;
  totals?: { revenue: number; cost: number; profit: number };
  customer?: { name: string; phone: string };
  items?: Array<{
    name?: string;
    qty?: number;
    [key: string]: any;
  }>;
  customizationText?: string;
  [key: string]: any;
};

function StatusBadge({ status }: { status: OrderRow["status"] }) {
  const s = String(status || "pending").toLowerCase().trim();
  const map: Record<string, string> = {
    pending: "border-[rgb(var(--warning))] bg-[rgb(var(--warning))/0.10] text-[rgb(var(--warning))]",
    paid: "border-[rgb(var(--primary))] bg-[rgb(var(--primary))/0.10] text-[rgb(var(--primary))]",
    delivered: "border-[rgb(var(--info))] bg-[rgb(var(--info))/0.10] text-[rgb(var(--info))]",
    cancelled: "border-[rgb(var(--danger))] bg-[rgb(var(--danger))/0.10] text-[rgb(var(--danger))]",
  };

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${map[s] || "border-app bg-card text-muted"}`}>
      {s}
    </span>
  );
}

function getCustomizationSummary(o: OrderRow): string {
  const direct = [o.customizationText, o.personalization, o.note, o.notes].find(v => typeof v === "string" && v.trim());
  if (direct) return direct;
  if (o.items?.length) {
    return o.items.map(it => it.name && it.qty ? `${it.name} x${it.qty}` : "").filter(Boolean).join(" • ");
  }
  return "";
}

export default function AdminOrdersPage() {
  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const qy = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      const snap = await getDocs(qy);
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    } catch (e) {
      console.error("Erro ao carregar pedidos:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ✅ AUTOMAÇÃO: Marcar como pago + Gerar movimento no Cashflow
  const markPaid = async (order: OrderRow) => {
    if (!confirm(`Confirmar pagamento de ${yen(order.totals?.revenue || 0)}?`)) return;
    
    setBusyId(order.id);
    const batch = writeBatch(db);

    try {
      // 1. Atualizar o Pedido
      const orderRef = doc(db, "orders", order.id);
      batch.update(orderRef, {
        status: "paid",
        paidAt: serverTimestamp(),
      });

      // 2. Criar Movimento Financeiro (Cashflow)
      const cashRef = doc(collection(db, "cash_movements"));
      const summary = order.items?.map(i => `${i.qty}x ${i.name}`).join(", ") || "Venda de produtos";
      
      batch.set(cashRef, {
        type: "in",
        category: "sale",
        amount: order.totals?.revenue || 0,
        orderId: order.id,
        itemsSummary: summary,
        note: `Automação: Pedido de ${order.customer?.name || "Cliente"}`,
        occurredAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      // Executa as duas operações juntas
      await batch.commit();

      // Atualiza o estado local para refletir a mudança imediatamente
      setItems(prev => prev.map(o => o.id === order.id ? { ...o, status: "paid" } : o));
      
    } catch (e: any) {
      console.error(e);
      alert("Erro na automação: " + e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminGuard>
      <div className="bg-app text-app min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-app">Pedidos</h1>
            <button onClick={load} className="text-xs text-[rgb(var(--primary))] hover:underline">
              Atualizar lista
            </button>
          </div>

          <div className="mt-2 text-sm text-muted">
            {loading ? "Carregando…" : `${items.length} pedido(s)`}
          </div>

          <div className="mt-4 grid gap-3">
            {items.map((o) => {
              const customizationSummary = getCustomizationSummary(o);
              const customizationLines = customizationSummary.split(/•|\n/).map(l => l.trim()).filter(Boolean);

              return (
                <div key={o.id} className="rounded-2xl border border-app bg-card p-4 shadow-sm transition-all hover:border-[rgb(var(--primary))/0.3]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-app flex items-center gap-2">
                        Pedido: <span className="font-mono text-sm text-muted">{o.id.slice(0,8)}...</span>
                        <StatusBadge status={o.status} />
                      </div>

                      <div className="mt-1 text-sm text-muted">
                        Cliente: <b className="text-app">{o.customer?.name || "-"}</b>
                        {o.createdAt && <span className="ml-2 text-xs opacity-60">| {o.createdAt.toDate().toLocaleString()}</span>}
                      </div>

                      {customizationSummary && (
                        <div className="mt-2 rounded-xl border border-app bg-card-muted px-3 py-2 text-sm">
                          {customizationLines.map((line, idx) => (
                            <div key={idx} className="text-app opacity-90">• {line}</div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-sm text-muted">Total</div>
                      <div className="text-xl font-bold text-app">{yen(o.totals?.revenue || 0)}</div>

                      <div className="mt-3 flex gap-2 justify-end">
                        <a href={`/admin/orders/${o.id}`} className="btn-ghost rounded-xl px-4 py-2 text-sm">
                          Detalhes
                        </a>

                        {o.status === "pending" && (
                          <button
                            disabled={busyId === o.id}
                            onClick={() => markPaid(o)}
                            className="rounded-xl bg-[rgb(var(--primary))] px-4 py-2 text-sm font-semibold text-[rgb(var(--panel2))] hover:brightness-110 disabled:opacity-60"
                          >
                            {busyId === o.id ? "Gravando..." : "Marcar como pago"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}