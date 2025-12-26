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
    const nextQty = Math.max(1, Number(qty || 1));
    const next = setLineQty(lineId, nextQty);
    setItems(next);

    try {
      window.dispatchEvent(new CustomEvent("cart:changed"));
    } catch {}
  };

  const remove = (lineId: string) => {
    const next = removeLine(lineId);
    setItems(next);

    try {
      window.dispatchEvent(new CustomEvent("cart:changed"));
    } catch {}
  };

  return (
    <div className="bg-app text-app min-h-screen">
      <StoreNav />

      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-bold text-app">{t("cart", lang)}</h1>

        {!mounted ? (
          <div className="mt-6 rounded-2xl border border-app bg-card p-4 text-sm text-muted shadow-sm">
            {t("cart_loading", lang)}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-app bg-card p-4 text-sm text-muted shadow-sm">
            {t("cart_empty", lang)}
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {items.map((it) => (
              <div
                key={it.lineId}
                className="flex items-center gap-3 rounded-2xl border border-app bg-card p-3 shadow-sm"
              >
                <div className="h-16 w-16 overflow-hidden rounded-xl border border-app bg-card-muted">
                  {it.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.photo} alt={it.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted">
                      {t("no_photo", lang)}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-app truncate">{it.name}</div>

                  {it.customText ? (
                    <div className="mt-1 text-xs text-muted">
                      {t("customization", lang)}:{" "}
                      <span className="text-app whitespace-pre-wrap break-words">{it.customText}</span>
                    </div>
                  ) : null}

                  <div className="mt-1 text-sm text-muted">
                    {yen(it.unitPrice)} {t("per_unit", lang)}
                  </div>
                </div>

                <input
                  inputMode="numeric"
                  type="number"
                  min={1}
                  value={it.qty}
                  onChange={(e) => updateQty(it.lineId, Number(e.target.value))}
                  className="input w-20 rounded-xl px-3 py-2 text-sm"
                  aria-label={t("quantity", lang)}
                />

                <button
                  onClick={() => remove(it.lineId)}
                  className="btn-ghost rounded-xl px-3 py-2 text-sm"
                >
                  {t("remove", lang)}
                </button>
              </div>
            ))}

            <div className="rounded-2xl border border-app bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted">{t("total", lang)}</div>
                <div className="text-lg font-bold text-app">{yen(totals.revenue)}</div>
              </div>

              <a
                href="/checkout"
                className="btn-primary mt-4 block w-full rounded-xl px-4 py-2 text-center text-sm font-semibold"
              >
                {t("checkout", lang)}
              </a>

              <div className="mt-2 text-xs text-muted">
                {items.length} {items.length === 1 ? "item" : "itens"}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
