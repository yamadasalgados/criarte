"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import type { Product } from "@/lib/db";
import StoreNav from "@/components/StoreNav";
import { yen } from "@/lib/money";
import { readCart, addLineItem, type CartItem } from "@/lib/cart";
import { getLang, onLangChanged, t, type Lang } from "@/lib/i18n";

function isProductActive(p: any) {
  if (typeof p.active === "boolean") return p.active;
  if (typeof p.status === "string") {
    const s = p.status.toLowerCase();
    return s === "active" || s === "available";
  }
  return true;
}

export default function StoreHome() {
  const [lang, setLang] = useState<Lang>("pt");

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [cartCount, setCartCount] = useState(0);

  // ✅ personalização por produto
  const [customById, setCustomById] = useState<Record<string, string>>({});

  const refreshCartCount = () => {
    const items = readCart();
    const totalQty = items.reduce((s, it) => s + Number(it.qty || 0), 0);
    setCartCount(totalQty);
  };

  const load = async () => {
    setLoading(true);
    try {
      const qy = query(collection(db, "products"), orderBy("createdAt", "desc"));
      const snap = await getDocs(qy);
      const list: Product[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setProducts(list.filter((p: any) => isProductActive(p)));
    } catch {
      const snap = await getDocs(collection(db, "products"));
      const list: Product[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setProducts(list.filter((p: any) => isProductActive(p)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLang(getLang());
    const off = onLangChanged((l) => setLang(l));

    load();
    refreshCartCount();

    const onCart = () => refreshCartCount();
    window.addEventListener("cart:changed", onCart as any);
    window.addEventListener("storage", onCart);

    return () => {
      off();
      window.removeEventListener("cart:changed", onCart as any);
      window.removeEventListener("storage", onCart);
    };
  }, []);

  const addToCart = (p: any) => {
    const unitPrice = Number(p.salePrice ?? p.price ?? 0);
    const unitCost = Number(p.unitCost ?? p.cost ?? 0);

    const customText = String(customById[p.id] || "").trim();

    const item: Omit<CartItem, "lineId"> = {
      productId: p.id,
      name: p.name,
      qty: 1,
      unitPrice,
      unitCost,
      photo: p.photos?.[0] || p.photo || p.image,
      customText: customText || undefined,
    };

    const next = addLineItem(item);

    // ✅ atualiza UI imediatamente
    setCartCount(next.reduce((s, it) => s + Number(it.qty || 0), 0));
    try {
      window.dispatchEvent(new CustomEvent("cart:changed"));
    } catch {}

    // ✅ limpa campo de personalização desse produto
    setCustomById((prev) => ({ ...prev, [p.id]: "" }));

    alert(t("shop_added_to_cart", lang));
  };

  const title = useMemo(() => t("shop_title", lang), [lang]);
  const subtitle = useMemo(() => t("shop_subtitle", lang), [lang]);

  return (
    <div className="bg-app">
      <StoreNav />

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-app">{title}</h1> 

          {/* ✅ Opcional: botão do carrinho aqui (além do ícone na navbar) */}
          <a
            href="/cart"
            className="btn-ghost rounded-xl px-3 py-2 text-sm"
            aria-label={`${t("cart", lang)} (${cartCount})`}
            title={`${t("cart", lang)} (${cartCount})`}
          >
            {t("cart", lang)} ({cartCount})
          </a>
        </div>

        <p className="mt-1 text-sm text-muted">{subtitle}</p>

        {loading ? (
          <div className="mt-6 text-muted">{t("shop_loading", lang)}</div>
        ) : products.length === 0 ? (
          <div className="mt-6 rounded-xl border border-app bg-card p-4 text-app">
            {t("shop_empty", lang)}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p: any) => {
              const imgSrc = p.photos?.[0] || p.photo || p.image;

              return (
                <div key={p.id} className="rounded-2xl border border-app bg-card p-4">
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-card-muted">
                    {imgSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgSrc} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                        {t("shop_no_photo", lang)}
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <div className="font-semibold text-app">{p.name}</div>
                    <div className="mt-1 text-sm text-muted">
                      {yen(Number(p.salePrice ?? p.price ?? 0))}
                    </div>
                  </div>

                  {/* ✅ Personalização (customText) */}
                  <label className="mt-3 block text-sm text-muted">
                    {t("shop_customization_label", lang)}
                    <input
                      value={customById[p.id] || ""}
                      onChange={(e) => setCustomById((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className="input mt-1 w-full rounded-xl px-3 py-2"
                      placeholder={t("shop_customization_placeholder", lang)}
                    />
                  </label>

                  <button
                    onClick={() => addToCart(p)}
                    className="btn-primary mt-4 w-full rounded-xl px-4 py-2 text-sm font-semibold"
                  >
                    {t("shop_add_to_cart", lang)}
                  </button>

                </div>
              );
            })}
          </div>
        )}

        {/* ✅ bloco final (opcional) */}
        <div className="mt-10 rounded-2xl border border-app bg-card p-4">
          <div className="font-semibold text-app">{t("shop_has_order_title", lang)}</div>
          <div className="mt-2 text-sm text-muted">{t("shop_has_order_text", lang)}</div>
          <a
            href="/chat"
            className="btn-ghost mt-3 inline-block rounded-xl px-3 py-2 text-sm"
          >
            {t("shop_go_to_chat", lang)}
          </a>
        </div>
      </main>
    </div>
  );
}
