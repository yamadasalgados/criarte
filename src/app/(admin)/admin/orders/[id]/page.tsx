"use client";

import AdminGuard from "@/components/AdminGuard";
import Navbar from "@/components/Navbar";
import { auth, db } from "@/lib/firebaseClient";
import { yen } from "@/lib/money";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { use, useEffect, useMemo, useState, useRef } from "react";

// --- COMPONENTES DE APOIO ---

function StatusBadge({ status }: { status: string }) {
  const s = String(status || "pending").toLowerCase().trim();
  const map: Record<string, { label: string; class: string }> = {
    pending: { label: "Pendente", class: "border-amber-500/50 bg-amber-500/10 text-amber-600" },
    paid: { label: "Pago", class: "border-emerald-500/50 bg-emerald-500/10 text-emerald-600" },
    delivered: { label: "Entregue", class: "border-blue-500/50 bg-blue-500/10 text-blue-600" },
    cancelled: { label: "Cancelado", class: "border-rose-500/50 bg-rose-500/10 text-rose-600" },
  };
  const config = map[s] || { label: s, class: "border-gray-500/50 bg-gray-500/10 text-gray-600" };
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${config.class}`}>
      {config.label}
    </span>
  );
}

export default function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = use(params);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    const unsubOrder = onSnapshot(doc(db, "orders", orderId), (snap) => {
      setOrder(snap.exists() ? snap.data() : null);
      setLoading(false);
    });

    const qy = query(collection(db, "orders", orderId, "messages"), orderBy("createdAt", "asc"));
    const unsubMsgs = onSnapshot(qy, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubOrder(); unsubMsgs(); };
  }, [orderId]);

  // Rolar chat para baixo
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleAction = async (action: "paid" | "delivered" | "cancelled") => {
    if (!confirm(`Deseja alterar o status para ${action}?`)) return;
    setBusy(action);
    try {
      if (action === "paid") {
        const token = await auth.currentUser?.getIdToken();
        await fetch(`/api/admin/orders/${orderId}/mark-paid`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await updateDoc(doc(db, "orders", orderId), {
          status: action,
          [`${action}At`]: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e: any) { alert(e.message); }
    finally { setBusy(null); }
  };

  if (loading) return <div className="p-10 text-center animate-pulse">Carregando dados completos...</div>;
  if (!order) return <div className="p-10 text-center">Pedido não encontrado.</div>;

  return (
    <AdminGuard>
      <div className="bg-app min-h-screen text-app">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8">
          
          {/* CABEÇALHO PRINCIPAL */}
          <header className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-app pb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-black tracking-tighter uppercase">Pedido #{orderId.slice(-6)}</h1>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-sm text-muted">ID Completo: <span className="font-mono">{orderId}</span></p>
              <p className="text-sm text-muted">Realizado em: <b>{order.createdAt?.toDate().toLocaleString('pt-BR')}</b></p>
            </div>

            <div className="flex flex-wrap gap-2">
              {order.status !== "paid" && (
                <button disabled={!!busy} onClick={() => handleAction("paid")} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all">Marcar Pago</button>
              )}
              <button disabled={!!busy} onClick={() => handleAction("delivered")} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all">Entregue</button>
              <button disabled={!!busy} onClick={() => handleAction("cancelled")} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-all">Cancelar</button>
            </div>
          </header>

          <div className="grid gap-8 lg:grid-cols-12">
            
            {/* COLUNA ESQUERDA: TODOS OS DETALHES DO PEDIDO */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* SEÇÃO: CLIENTE E ENTREGA (O que estava faltando) */}
              <div className="grid gap-6 md:grid-cols-2">
                <section className="card-detail">
                  <h2 className="title-section">👤 Cliente</h2>
                  <div className="space-y-1 mt-2 text-sm">
                    <p className="font-bold text-lg">{order.customer?.name}</p>
                    <p className="text-muted">{order.customer?.phone}</p>
                    <p className="text-muted">{order.customer?.email}</p>
                  </div>
                </section>

                <section className="card-detail">
                  <h2 className="title-section">📍 Entrega / Retirada</h2>
                  <div className="space-y-1 mt-2 text-sm">
                    {order.deliveryAddress ? (
                      <>
                        <p className="font-medium text-app">{order.deliveryAddress.street}, {order.deliveryAddress.number}</p>
                        <p className="text-muted">{order.deliveryAddress.neighborhood} - {order.deliveryAddress.city}</p>
                        <p className="text-muted">CEP: {order.deliveryAddress.zipCode}</p>
                        {order.deliveryAddress.complement && (
                          <p className="text-xs bg-app p-1 rounded mt-1 italic">Ref: {order.deliveryAddress.complement}</p>
                        )}
                      </>
                    ) : (
                      <p className="italic text-muted font-bold text-rose-500">Retirada no Local</p>
                    )}
                  </div>
                </section>
              </div>

              {/* SEÇÃO: FINANCEIRO E PAGAMENTO */}
              <section className="card-detail">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="title-section">💰 Pagamento</h2>
                  <span className="text-xs font-bold px-2 py-1 bg-app border border-app rounded-lg uppercase">
                    {order.paymentMethod || "Não informado"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="summary-box">
                    <span className="label">Total</span>
                    <span className="value">{yen(order.totals?.revenue)}</span>
                  </div>
                  <div className="summary-box">
                    <span className="label">Custo Est.</span>
                    <span className="value text-rose-500">{yen(order.totals?.cost)}</span>
                  </div>
                  <div className="summary-box bg-emerald-500/10 border-emerald-500/20">
                    <span className="label text-emerald-600">Lucro Est.</span>
                    <span className="value text-emerald-600">{yen(order.totals?.profit)}</span>
                  </div>
                </div>
              </section>

              {/* SEÇÃO: ITENS E OBSERVAÇÕES */}
              <section className="card-detail">
                <h2 className="title-section mb-4">📦 Itens e Personalização</h2>
                <div className="space-y-4">
                  {order.items?.map((it: any, i: number) => (
                    <div key={i} className="flex gap-4 p-4 rounded-2xl bg-app border border-app">
                      <div className="flex-1">
                        <div className="flex justify-between">
                           <p className="font-black text-app">{it.nameSnapshot} <span className="text-muted font-normal ml-2">x{it.qty}</span></p>
                           <p className="font-bold">{yen(it.unitPriceSnapshot * it.qty)}</p>
                        </div>
                        {/* Exibe a personalização ou notas do item */}
                        {(it.customizationText || it.note) && (
                          <div className="mt-2 p-3 rounded-xl bg-card-muted text-xs border border-app border-l-4 border-l-primary italic">
                             <p className="font-bold uppercase text-[9px] mb-1 opacity-50 text-muted italic">Observação do Item:</p>
                             "{it.customizationText || it.note}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notas Gerais do Pedido */}
                {order.notes && (
                  <div className="mt-6 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                    <h3 className="text-[10px] font-black uppercase tracking-widest mb-1 text-amber-600">Observação Geral do Pedido</h3>
                    <p className="text-sm italic">"{order.notes}"</p>
                  </div>
                )}
              </section>
            </div>

            {/* COLUNA DIREITA: CHAT */}
            <div className="lg:col-span-5">
               {/* Mesma estrutura do Chat anterior, focada em UX */}
               <section className="flex flex-col h-[750px] rounded-3xl border border-app bg-card shadow-2xl overflow-hidden sticky top-6">
                  <div className="p-4 border-b border-app bg-card-muted/50 flex justify-between items-center">
                    <h2 className="font-black uppercase text-xs tracking-widest">Chat de Suporte</h2>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  </div>

                  <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-app/40">
                    {messages.map((m) => {
                      const isAdmin = m.senderRole === "admin";
                      return (
                        <div key={m.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[85%] p-3 rounded-2xl border ${
                            isAdmin ? "bg-emerald-600 border-emerald-500 text-white rounded-tr-none" : "bg-card border-app text-app rounded-tl-none"
                          }`}>
                            {m.imageUrl && <img src={m.imageUrl} alt="Anexo" className="rounded-xl mb-2 max-h-60 w-full object-cover shadow-lg" />}
                            <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                            <p className="text-[9px] mt-1 opacity-60 font-bold uppercase">{m.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-4 bg-card border-t border-app">
                    <div className="flex items-center gap-2">
                       <input 
                        value={text} 
                        onChange={e => setText(e.target.value)}
                        placeholder="Enviar mensagem..."
                        className="flex-1 bg-app border border-app rounded-2xl px-4 py-2 text-sm outline-none"
                       />
                       <button className="p-2 bg-emerald-600 text-white rounded-full"><SendIcon /></button>
                    </div>
                  </div>
               </section>
            </div>

          </div>
        </main>
      </div>

      <style jsx>{`
        .card-detail { @apply rounded-3xl border border-app bg-card p-6 shadow-sm; }
        .title-section { @apply text-xs font-black uppercase tracking-widest text-muted; }
        .summary-box { @apply rounded-2xl bg-app p-4 border border-app flex flex-col; }
        .summary-box .label { @apply text-[9px] uppercase font-bold text-muted mb-1; }
        .summary-box .value { @apply text-lg font-black tracking-tight; }
        .btn-action-green { @apply rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition-all; }
        .btn-action-white { @apply rounded-xl bg-app border border-app px-4 py-2 text-sm font-bold hover:bg-card-muted transition-all; }
        .btn-action-red { @apply rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-500/20 transition-all; }
      `}</style>
    </AdminGuard>
  );
}

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
);