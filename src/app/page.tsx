"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { yen } from "@/lib/money";
import { readCart, addLineItem, type CartItem } from "@/lib/cart";
import StoreNav from "@/components/StoreNav";
import { getLang, onLangChanged, t, type Lang } from "@/lib/i18n";

type Product = {
  id: string;
  name: string;
  salePrice: number;
  unitCost: number;
  photos: string[];
  active: boolean;
  createdAt?: any;
};

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // cart
  const [cartCount, setCartCount] = useState(0);

  // texto de personalização por produto
  const [customById, setCustomById] = useState<Record<string, string>>({});

  // idioma atual
  const [lang, setLangState] = useState<Lang>("pt");

  // feedback pequeno (em vez de alert)
  const [toast, setToast] = useState<string | null>(null);

  const labels = useMemo(() => {
    return {
      title: t("shop_title", lang),
      subtitle: t("shop_subtitle", lang),
      loading: t("shop_loading", lang),
      empty: t("shop_empty", lang),
      price: t("shop_price", lang),
      customizationLabel: t("shop_customization_label", lang),
      customizationPlaceholder: t("shop_customization_placeholder", lang),
      addToCart: t("shop_add_to_cart", lang),
      addedAlert: t("shop_added_to_cart", lang),
      noPhoto: t("shop_no_photo", lang),
      hasOrderTitle: t("shop_has_order_title", lang),
      hasOrderText: t("shop_has_order_text", lang),
      goToChat: t("shop_go_to_chat", lang),
    };
  }, [lang]);

  const refreshCartCount = () => {
    const items = readCart();
    setCartCount(items.reduce((s, it) => s + Number(it.qty || 0), 0));
  };

  const load = async () => {
    setLoading(true);
    try {
      const qy = query(
        collection(db, "products"),
        where("active", "==", true),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(qy);
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Product[];
      setProducts(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLangState(getLang());
    const off = onLangChanged((l) => setLangState(l));

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const tmr = setTimeout(() => setToast(null), 1200);
    return () => clearTimeout(tmr);
  }, [toast]);

  const addToCart = (p: Product) => {
    const customText = String(customById[p.id] || "").trim();

    const item: Omit<CartItem, "lineId"> = {
      productId: p.id,
      name: p.name,
      photo: p.photos?.[0],
      unitPrice: Number(p.salePrice || 0),
      unitCost: Number(p.unitCost || 0),
      qty: 1,
      customText: customText || undefined,
    };

    const items = addLineItem(item);

    // atualiza UI local + avisa navbar sem reload
    setCartCount(items.reduce((s, it) => s + Number(it.qty || 0), 0));
    try {
      window.dispatchEvent(new CustomEvent("cart:changed"));
    } catch {}

    // limpa o input desse produto após adicionar
    setCustomById((prev) => ({ ...prev, [p.id]: "" }));

    // feedback leve
    setToast(labels.addedAlert);
  };

  return (
    <div className="bg-app text-app">
      <StoreNav />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{labels.title}</h1>
        </div>

        <p className="mt-2 text-sm text-muted">{labels.subtitle}</p>

        <div className="mt-6">
          {loading ? (
            <div className="text-muted">{labels.loading}</div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-app bg-card p-4 text-muted">{labels.empty}</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <div key={p.id} className="rounded-2xl border border-app bg-card p-4 shadow-sm">
                  <div className="aspect-[4/3] overflow-hidden rounded-xl bg-card-muted">
                    {p.photos?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photos[0]} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted">
                        {labels.noPhoto}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 font-semibold">{p.name}</div>

                  <div className="mt-1 text-sm text-muted">
                    {labels.price}: <b className="text-app">{yen(p.salePrice || 0)}</b>
                  </div>

                  {/* Customização do cliente */}
                  <label className="mt-3 block text-sm text-muted">
                    {labels.customizationLabel}
                    <input
                      value={customById[p.id] || ""}
                      onChange={(e) =>
                        setCustomById((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      className="input mt-1 w-full rounded-xl px-3 py-2"
                      placeholder={labels.customizationPlaceholder}
                    />
                  </label>

                  <button
                    onClick={() => addToCart(p)}
                    className="btn-primary mt-4 w-full rounded-xl px-4 py-2 text-sm font-semibold"
                  >
                    {labels.addToCart}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10 rounded-2xl border border-app bg-card p-4">
          <div className="font-semibold">{labels.hasOrderTitle}</div>
          <div className="mt-2 text-sm text-muted">{labels.hasOrderText}</div>
          <a href="/chat" className="btn-ghost mt-3 inline-block rounded-xl px-3 py-2 text-sm">
            {labels.goToChat}
          </a>
        </div>
      </main>

      {/* toast simples */}
      {toast ? (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
          <div className="rounded-full border border-app bg-card px-4 py-2 text-sm shadow-md">
            {toast}
          </div>
        </div>
      ) : null}
    </div>
  );
}
