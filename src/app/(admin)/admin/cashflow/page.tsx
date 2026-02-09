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
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

// Helper robusto para converter qualquer formato de data do Firestore
function toDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export default function AdminFinancePage() {
  const [allItems, setAllItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Mês agora começa vazio para mostrar "Tudo" por padrão
  const [selectedMonth, setSelectedMonth] = useState("");

  // Estados do formulário
  const [type, setType] = useState<"out" | "in">("out");
  const [category, setCategory] = useState("material");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const qy = query(collection(db, "cash_movements"), orderBy("occurredAt", "desc"));
      const snap = await getDocs(qy);
      
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          // Mapeia nomes alternativos de campos para garantir compatibilidade
          computedAmount: Number(data.amount || data.valor || data.price || 0),
          computedDate: toDate(data.occurredAt || data.createdAt || data.data)
        };
      });
      
      setAllItems(list);
    } catch (e) {
      console.error("Erro ao ler Firestore:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // FILTRO DINÂMICO: Se selectedMonth estiver vazio, mostra TUDO.
  const filteredItems = useMemo(() => {
    if (!selectedMonth) return allItems;

    const [y, m] = selectedMonth.split("-").map(Number);
    return allItems.filter(item => {
      const d = item.computedDate;
      if (!d) return false;
      return d.getFullYear() === y && (d.getMonth() + 1) === m;
    });
  }, [allItems, selectedMonth]);

  const summaries = useMemo(() => {
    const calc = (list: any[]) => list.reduce((acc, cur) => {
      const val = cur.computedAmount || 0;
      if (cur.type === "in") acc.in += val;
      else acc.out += val;
      return acc;
    }, { in: 0, out: 0 });

    return {
      filtered: calc(filteredItems),
      all: calc(allItems)
    };
  }, [filteredItems, allItems]);

  const create = async () => {
    const a = Number(amount);
    if (!a || a <= 0) return alert("Valor inválido.");
    setBusy(true);
    try {
      await addDoc(collection(db, "cash_movements"), {
        type,
        category,
        amount: a,
        note: note.trim(),
        occurredAt: Timestamp.fromDate(new Date(`${date}T12:00:00`)),
        createdAt: serverTimestamp(),
      });
      setAmount("");
      setNote("");
      loadData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminGuard>
      <div className="bg-app text-app min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-6">
          
          <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold">Financeiro</h1>
              <p className="text-sm text-muted">Exibindo {selectedMonth ? `dados de ${selectedMonth}` : "todo o histórico"}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSelectedMonth("")}
                className={`text-xs px-3 py-2 rounded-xl border ${!selectedMonth ? 'bg-primary text-white border-primary' : 'border-app text-muted'}`}
              >
                Ver Tudo
              </button>
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)} 
                className="rounded-xl border border-app bg-card px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <SummaryCard 
              title={selectedMonth ? "Saldo do Período" : "Saldo Acumulado"} 
              value={summaries.filtered.in - summaries.filtered.out} 
            />
            <SummaryCard 
              title="Entradas" 
              value={summaries.filtered.in} 
              isGood 
            />
            <SummaryCard 
              title="Saídas" 
              value={summaries.filtered.out} 
              isBad 
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* FORMULÁRIO */}
            <section className="bg-card border border-app p-6 rounded-3xl h-fit shadow-sm">
              <h2 className="font-bold mb-4">Novo Lançamento</h2>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-muted font-bold">TIPO</label>
                  <label className="text-xs text-muted font-bold">CATEGORIA</label>
                  <select value={type} onChange={e => setType(e.target.value as any)} className="input-select">
                    <option value="out">Saída (Gasto)</option>
                    <option value="in">Entrada (Ajuste)</option>
                  </select>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="input-select">
                    <option value="material">Matéria-prima</option>
                    <option value="equipment">Equipamento</option>
                    <option value="accessory">Acessórios</option>
                    <option value="other">Outros</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-muted font-bold">VALOR (¥)</label>
                  <label className="text-xs text-muted font-bold">DATA</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="input-field" />
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field" />
                </div>

                <label className="text-xs text-muted font-bold block mt-2">OBSERVAÇÃO</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ex: Compra de acrílico..." className="input-field h-20 w-full resize-none" />
                
                <button disabled={busy} onClick={create} className="btn-primary w-full py-3 rounded-xl font-bold mt-2">
                  {busy ? "Salvando..." : "Confirmar Lançamento"}
                </button>
              </div>
            </section>

            {/* LISTA / EXTRATO */}
            <section className="bg-card border border-app p-6 rounded-3xl shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold">Extrato</h2>
                <span className="text-[10px] bg-app px-2 py-1 rounded-lg border border-app text-muted uppercase">
                  {filteredItems.length} Registros
                </span>
              </div>
              
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {loading ? (
                  <p className="text-muted text-sm animate-pulse">Buscando dados no banco...</p>
                ) : filteredItems.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 rounded-2xl bg-app border border-app hover:border-primary/30 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                         <span className={`w-2 h-2 rounded-full ${item.type === 'in' ? 'bg-[rgb(var(--primary))]' : 'bg-[rgb(var(--danger))]'}`}></span>
                         <p className="text-[10px] font-bold uppercase text-muted tracking-wider">{item.category}</p>
                      </div>
                      <p className="text-sm font-medium mt-1">{item.note || "Sem descrição"}</p>
                      <p className="text-[10px] text-muted">{item.computedDate?.toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-lg ${item.type === 'in' ? 'text-[rgb(var(--primary))]' : 'text-[rgb(var(--danger))]'}`}>
                        {item.type === 'in' ? '+' : '-'}{yen(item.computedAmount)}
                      </p>
                    </div>
                  </div>
                ))}
                
                {!loading && filteredItems.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-sm text-muted">Nenhum lançamento encontrado.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>

      <style jsx>{`
        .input-select, .input-field {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(var(--border-app));
          background-color: rgb(var(--bg-app));
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(var(--primary), 0.2);
          border-radius: 10px;
        }
      `}</style>
    </AdminGuard>
  );
}

function SummaryCard({ title, value, isGood, isBad }: any) {
  let color = "text-app";
  if (isGood) color = "text-[rgb(var(--primary))]";
  if (isBad) color = "text-[rgb(var(--danger))]";
  return (
    <div className="bg-card border border-app p-4 rounded-2xl shadow-sm">
      <p className="text-xs text-muted font-bold uppercase tracking-tight">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{yen(value)}</p>
    </div>
  );
}