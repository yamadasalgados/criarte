"use client";

import AdminGuard from "@/components/AdminGuard";
import Navbar from "@/components/Navbar";
import { db } from "@/lib/firebaseClient";
import { yen } from "@/lib/money";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

type Movement = {
  id: string;
  type: "in" | "out";
  category: "sale" | "equipment" | "accessory" | "material" | "other";
  amount: number;

  itemsSummary?: string;

  note?: string;
  orderId?: string;
  occurredAt?: Timestamp;
  createdAt?: any;
};

function monthKey(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function startOfMonth(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-").map((x) => Number(x));
  return new Date(y, (m || 1) - 1, 1, 0, 0, 0, 0);
}

function endOfMonthExclusive(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-").map((x) => Number(x));
  return new Date(y, (m || 1), 1, 0, 0, 0, 0);
}

function labelCategory(cat: Movement["category"]) {
  switch (cat) {
    case "sale":
      return "Venda";
    case "equipment":
      return "Equipamento";
    case "accessory":
      return "Acessórios";
    case "material":
      return "Matéria-prima";
    case "other":
      return "Outros / Ajuste";
    default:
      return String(cat);
  }
}

export default function AdminFinancePage() {
  const [items, setItems] = useState<Movement[]>([]);
  const [allItems, setAllItems] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState(() => monthKey(new Date()));

  const [type, setType] = useState<"out" | "in">("out");
  const [category, setCategory] = useState<Movement["category"]>("equipment");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const loadMonth = async (monthKeyValue: string) => {
    setLoading(true);

    const start = Timestamp.fromDate(startOfMonth(monthKeyValue));
    const end = Timestamp.fromDate(endOfMonthExclusive(monthKeyValue));

    const qy = query(
      collection(db, "cash_movements"),
      where("occurredAt", ">=", start),
      where("occurredAt", "<", end),
      orderBy("occurredAt", "desc")
    );

    const snap = await getDocs(qy);
    const list: Movement[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    setItems(list);
    setLoading(false);
  };

  const loadAll = async () => {
    const snap = await getDocs(collection(db, "cash_movements"));
    const list: Movement[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    setAllItems(list);
  };

  useEffect(() => {
    loadMonth(month);
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const summaryMonth = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;

    for (const m of items) {
      if (m.type === "in") totalIn += Number(m.amount || 0);
      else totalOut += Number(m.amount || 0);
    }

    const balance = totalIn - totalOut;
    return { totalIn, totalOut, balance };
  }, [items]);

  const summaryAll = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;

    for (const m of allItems) {
      if (m.type === "in") totalIn += Number(m.amount || 0);
      else totalOut += Number(m.amount || 0);
    }

    const balance = totalIn - totalOut;
    return { totalIn, totalOut, balance };
  }, [allItems]);

  const create = async () => {
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) return alert("Valor inválido.");

    if (!date) return alert("Data inválida.");
    const occurred = new Date(`${date}T00:00:00`);
    if (Number.isNaN(occurred.getTime())) return alert("Data inválida.");

    if (category === "sale") {
      return alert("Vendas (sale) entram automaticamente ao marcar o pedido como PAID.");
    }

    if (type === "in" && category !== "other") {
      return alert("Entrada manual só é permitida com categoria 'other' (ajuste).");
    }

    setBusy(true);
    try {
      await addDoc(collection(db, "cash_movements"), {
        type,
        category,
        amount: a,
        note: note.trim(),
        occurredAt: Timestamp.fromDate(occurred),
        createdAt: serverTimestamp(),
      });

      setAmount("");
      setNote("");
      await loadMonth(month);
      await loadAll();
    } catch (e: any) {
      alert(e?.message || "Erro ao lançar movimento");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminGuard>
      <div className="bg-app text-app min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-app">Financeiro</h1>
              <p className="mt-1 text-sm text-muted">
                Fluxo de caixa profissional: entradas via pedidos pagos + saídas manuais. Moeda: ¥.
              </p>
            </div>

            <label className="text-sm text-app">
              Mês
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="ml-2 rounded-xl border border-app bg-card px-3 py-2 text-app"
              />
            </label>
          </div>

          {/* RESUMO GERAL */}
          <div className="mt-8 rounded-2xl border border-app bg-card p-4 shadow-sm">
            <div className="mb-3 font-semibold text-app">Resumo geral (desde o início)</div>
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryCard title="Entradas totais" value={summaryAll.totalIn} tone="good" />
              <SummaryCard title="Saídas totais" value={summaryAll.totalOut} tone="bad" />
              <SummaryCard
                title="Saldo acumulado"
                value={summaryAll.balance}
                tone={summaryAll.balance >= 0 ? "good" : "bad"}
              />
            </div>
          </div>

          {/* RESUMO DO MÊS */}
          <div className="mt-6 rounded-2xl border border-app bg-card p-4 shadow-sm">
            <div className="mb-3 font-semibold text-app">Resumo do mês</div>
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryCard title="Entradas do mês" value={summaryMonth.totalIn} tone="good" />
              <SummaryCard title="Saídas do mês" value={summaryMonth.totalOut} tone="bad" />
              <SummaryCard
                title="Saldo do mês"
                value={summaryMonth.balance}
                tone={summaryMonth.balance >= 0 ? "good" : "bad"}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {/* FORM */}
            <div className="rounded-2xl border border-app bg-card p-4 shadow-sm">
              <div className="font-semibold text-app">Novo lançamento</div>
              <div className="mt-1 text-xs text-muted">
                Vendas entram automaticamente ao marcar pedido como <b>PAID</b>.
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-app">
                  Tipo
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-app bg-card px-3 py-2 text-app"
                  >
                    <option value="out">Saída (gasto)</option>
                    <option value="in">Entrada (ajuste)</option>
                  </select>
                </label>

                <label className="text-sm text-app">
                  Categoria
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-app bg-card px-3 py-2 text-app"
                  >
                    <option value="equipment">Equipamento</option>
                    <option value="accessory">Acessórios</option>
                    <option value="material">Matéria-prima</option>
                    <option value="other">Outros / Ajuste</option>
                    <option value="sale">Venda (automático)</option>
                  </select>
                </label>

                <label className="text-sm text-app">
                  Valor (¥)
                  <input
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                    className="mt-1 w-full rounded-xl border border-app bg-card px-3 py-2 text-app"
                    placeholder="ex: 5000"
                  />
                </label>

                <label className="text-sm text-app">
                  Data
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-app bg-card px-3 py-2 text-app"
                  />
                </label>

                <label className="text-sm text-app sm:col-span-2">
                  Observação (opcional)
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-app bg-card px-3 py-2 text-app"
                    placeholder="ex: acrílico, madeira, lâmina, manutenção"
                  />
                </label>
              </div>

              <button
                disabled={busy}
                onClick={create}
                className="mt-4 rounded-xl bg-[rgb(var(--primary))] px-4 py-2 text-sm font-semibold text-[rgb(var(--panel2))] hover:brightness-110 disabled:opacity-60"
              >
                {busy ? "Salvando…" : "Lançar"}
              </button>
            </div>

            {/* LIST */}
            <div className="rounded-2xl border border-app bg-card p-4 shadow-sm">
              <div className="font-semibold text-app">Extrato do mês</div>
              <div className="mt-2 text-sm text-muted">
                {loading ? "Carregando…" : `${items.length} movimento(s)`}
              </div>

              <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {items.map((m) => {
                  const dateText = m.occurredAt ? m.occurredAt.toDate().toISOString().slice(0, 10) : "-";
                  const isIn = m.type === "in";

                  const line1 = `${dateText} • ${isIn ? "Entrada" : "Saída"}`;
                  const line2 = isIn ? (m.itemsSummary?.trim() || "Venda") : labelCategory(m.category);
                  const value = Number(m.amount || 0);

                  const valueClass = isIn ? "text-[rgb(var(--primary))]" : "text-[rgb(var(--danger))]";
                  const cardTone = isIn
                    ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))/0.06]"
                    : "border-app bg-card-muted";

                  return (
                    <div key={m.id} className={`rounded-2xl border p-4 ${cardTone}`}>
                      <div className="text-sm font-semibold text-app">{line1}</div>
                      <div className="mt-1 text-sm text-muted">{line2}</div>

                      <div className={`mt-2 text-lg font-bold ${valueClass}`}>
                        {isIn ? "+" : "-"}
                        {yen(value)}
                      </div>

                      {m.note?.trim() ? (
                        <div className="mt-2 text-xs text-muted whitespace-pre-wrap break-words">
                          {m.note.trim()}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {!loading && items.length === 0 && (
                  <div className="rounded-xl border border-app bg-card-muted p-4 text-sm text-muted">
                    Nenhum movimento nesse mês.
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}

function SummaryCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "good" | "bad";
}) {
  const valueClass = tone === "good" ? "text-[rgb(var(--primary))]" : "text-[rgb(var(--danger))]";

  return (
    <div className="rounded-2xl border border-app bg-card p-4 shadow-sm">
      <div className="text-sm text-muted">{title}</div>
      <div className={`mt-1 text-2xl font-bold ${valueClass}`}>{yen(Number(value || 0))}</div>
    </div>
  );
}
