"use client";

import { useEffect, useMemo, useState } from "react";
import StoreNav from "@/components/StoreNav";
import { yen } from "@/lib/money";
import { readCart, setLineQty, removeLine, cartTotals, type CartItem } from "@/lib/cart";
import { getLang, onLangChanged, t, type Lang } from "@/lib/i18n";

export default function CartPage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [lang, setLangState] = useState<Lang>("pt");

  useEffect(() => {
    setLangState(getLang());
    const off = onLangChanged((l) => setLangState(l));

    setMounted(true);
    setItems(readCart());

    return () => off();
  }, []);

  const totals = useMemo(() => cartTotals(items), [items]);

  const updateQty = (lineId: string, qty: number) => {
    const nextQty = Math.max(1, Math.floor(Number(qty || 1)));
    const next = setLineQty(lineId, nextQty);
    setItems(next);

    try {
      window.dispatchEvent(new CustomEvent("cart:changed"));
    } catch {}
  };

  const remove = (lineId: string) => {
    // Corrigido para evitar erro de compilação: 
    // Usando uma chave garantida ou apenas o texto de fallback se a chave não existir no Type
    const msg = lang === "pt" ? "Remover este item?" : "Remove this item?";
    
    if (!confirm(msg)) return;
    
    const next = removeLine(lineId);
    setItems(next);

    try {
      window.dispatchEvent(new CustomEvent("cart:changed"));
    } catch {}
  };

  return (
    <div className="bg-app text-app min-h-screen">
      <StoreNav />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight text-app italic uppercase">
          {t("cart", lang)}
        </h1>

        {!mounted ? (
          <div className="mt-6 rounded-2xl border border-app bg-card p-8 text-center text-sm text-muted animate-pulse">
            {t("cart_loading", lang)}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-app bg-card p-12 text-center shadow-sm">
            <div className="text-muted mb-4">{t("cart_empty", lang)}</div>
            <a href="/" className="btn-ghost inline-block rounded-xl px-6 py-2 text-sm font-semibold">
              Voltar
            </a>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {items.map((it) => (
              <div
                key={it.lineId}
                className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-app bg-card p-4 shadow-sm"
              >
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-app bg-card-muted mx-auto sm:mx-0">
                  {it.photo ? (
                    <img src={it.photo} alt={it.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted uppercase font-bold">
                      N/A
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <div className="font-bold text-lg text-app truncate">{it.name}</div>

                  {it.customText ? (
                    <div className="mt-1 text-xs text-muted inline-block bg-app/30 px-2 py-1 rounded-lg">
                      <span className="text-app italic">"{it.customText}"</span>
                    </div>
                  ) : null}

                  <div className="mt-1 text-sm font-medium text-primary uppercase tracking-wider">
                    {yen(it.unitPrice)}
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 border-t border-app pt-4 sm:border-0 sm:pt-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-black text-muted tracking-widest">Qtd:</span>
                    <input
                      inputMode="numeric"
                      type="number"
                      min={1}
                      value={it.qty}
                      onChange={(e) => updateQty(it.lineId, Number(e.target.value))}
                      className="input w-16 rounded-xl px-2 py-2 text-center text-sm font-bold"
                    />
                  </div>

                  <button
                    onClick={() => remove(it.lineId)}
                    className="p-2 text-[rgb(var(--danger))] hover:bg-[rgb(var(--danger))/0.1] rounded-xl transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-app bg-card p-6 shadow-md">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-muted">{t("total", lang)}</div>
                <div className="text-2xl font-black text-primary italic tracking-tighter">
                  {yen(totals.revenue)}
                </div>
              </div>
              
              <div className="text-[10px] text-muted uppercase tracking-widest mb-6 border-b border-app pb-4">
                {items.length} {items.length === 1 ? "item" : "itens"}
              </div>

              <a
                href="/checkout"
                className="btn-primary block w-full rounded-2xl py-4 text-center text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all"
              >
                {t("checkout", lang)}
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}