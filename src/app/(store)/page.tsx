"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import type { Product } from "@/lib/db";
import StoreNav from "@/components/StoreNav";
import { yen } from "@/lib/money";
import { readCart, addLineItem, type CartItem } from "@/lib/cart";
import { getLang, onLangChanged, t, type Lang } from "@/lib/i18n";

/* --- COMPONENTES AUXILIARES --- */

function ProductSkeleton() {
  return (
    <div className="rounded-2xl border border-app bg-card p-4 animate-pulse">
      <div className="aspect-[4/3] w-full rounded-xl bg-card-muted" />
      <div className="mt-4 h-4 w-3/4 rounded bg-card-muted" />
      <div className="mt-2 h-3 w-1/4 rounded bg-card-muted" />
      <div className="mt-6 h-10 w-full rounded-xl bg-card-muted" />
    </div>
  );
}

export default function StoreHome() {
  const [lang, setLang] = useState<Lang>("pt");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [customById, setCustomById] = useState<Record<string, string>>({});
  
  // Estado para feedback visual no botão
  const [addingId, setAddingId] = useState<string | null>(null);

  const refreshCartCount = () => {
    const items = readCart();
    setCartCount(items.reduce((s, it) => s + (Number(it.qty) || 0), 0));
  };

  const load = async () => {
    setLoading(true);
    try {
      const qy = query(collection(db, "products"), orderBy("createdAt", "desc"));
      const snap = await getDocs(qy);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      setProducts(list.filter((p: any) => p.active !== false));
    } catch (err) {
      console.error("Erro ao carregar produtos", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLang(getLang());
    const off = onLangChanged(setLang);
    load();
    refreshCartCount();

    const onCart = () => refreshCartCount();
    window.addEventListener("cart:changed", onCart);
    return () => {
      off();
      window.removeEventListener("cart:changed", onCart);
    };
  }, []);

  const addToCart = (p: any) => {
    setAddingId(p.id);
    
    const item: Omit<CartItem, "lineId"> = {
      productId: p.id,
      name: p.name,
      qty: 1,
      unitPrice: Number(p.salePrice || 0),
      unitCost: Number(p.unitCost || 0),
      photo: p.photos?.[0] || p.photo,
      customText: customById[p.id]?.trim() || undefined,
    };

    addLineItem(item);
    window.dispatchEvent(new CustomEvent("cart:changed"));
    setCustomById(prev => ({ ...prev, [p.id]: "" }));

    // Remove feedback de "adicionado" após 1.5s
    setTimeout(() => setAddingId(null), 1500);
  };

  return (
    <div className="bg-app min-h-screen text-app font-sans">
      <StoreNav />

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* HEADER DA LOJA */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic text-app">
              {t("shop_title", lang)}
            </h1>
            <p className="text-muted text-sm mt-1">{t("shop_subtitle", lang)}</p>
          </div>
          
          <a href="/cart" className="flex items-center gap-3 bg-card border border-app px-5 py-2.5 rounded-2xl hover:bg-card-muted transition-all group">
            <span className="text-xs font-black uppercase tracking-widest text-muted group-hover:text-primary">
              {t("cart", lang)}
            </span>
            <span className="bg-primary text-[rgb(var(--panel2))] text-[10px] font-black px-2 py-0.5 rounded-full">
              {cartCount}
            </span>
          </a>
        </header>

        {/* LISTA DE PRODUTOS */}
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => <ProductSkeleton key={i} />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-app rounded-3xl">
            <p className="text-muted uppercase font-black tracking-widest">{t("shop_empty", lang)}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p: any) => {
              const imgSrc = p.photos?.[0] || p.photo || p.image;
              const isAdded = addingId === p.id;

              return (
                <div key={p.id} className="group relative flex flex-col rounded-3xl border border-app bg-card overflow-hidden hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300">
                  
                  {/* IMAGEM COM HOVER EFFECT */}
                  <div className="aspect-[4/3] overflow-hidden bg-card-muted">
                    {imgSrc ? (
                      <img 
                        src={imgSrc} 
                        alt={p.name} 
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" 
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-black uppercase text-muted">
                        {t("shop_no_photo", lang)}
                      </div>
                    )}
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex justify-between items-start gap-2 mb-4">
                      <h3 className="font-bold text-lg text-app leading-tight">{p.name}</h3>
                      <span className="text-primary font-black tracking-tighter whitespace-nowrap">
                        {yen(Number(p.salePrice || 0))}
                      </span>
                    </div>

                    {/* PERSONALIZAÇÃO - ESTILO BACKSTAGE */}
                    <div className="mt-auto space-y-4">
                      <div className="relative">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted mb-1 block">
                          {t("shop_customization_label", lang)}
                        </label>
                        <input
                          value={customById[p.id] || ""}
                          onChange={(e) => setCustomById(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder={t("shop_customization_placeholder", lang)}
                          className="w-full bg-app border border-app rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary/50 transition-all"
                        />
                      </div>

                      <button
                        onClick={() => addToCart(p)}
                        disabled={isAdded}
                        className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg 
                          ${isAdded 
                            ? "bg-emerald-500 text-white shadow-emerald-500/20" 
                            : "bg-primary text-[rgb(var(--panel2))] hover:brightness-110 shadow-primary/20 active:scale-95"
                          }`}
                      >
                        {isAdded ? "✓ Adicionado" : t("shop_add_to_cart", lang)}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* FOOTER CALL TO ACTION */}
        <section className="mt-20 p-8 rounded-[2.5rem] border border-app bg-gradient-to-br from-card to-card-muted flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          </div>
          <h2 className="text-xl font-black uppercase tracking-tighter text-app italic">{t("shop_has_order_title", lang)}</h2>
          <p className="mt-2 text-sm text-muted max-w-md leading-relaxed">{t("shop_has_order_text", lang)}</p>
          <a href="/chat" className="mt-6 px-8 py-3 bg-card border border-app rounded-xl text-xs font-black uppercase tracking-widest hover:bg-app transition-all">
            {t("shop_go_to_chat", lang)}
          </a>
        </section>
      </main>

      <style jsx>{`
        .input::placeholder { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.4; }
      `}</style>
    </div>
  );
}