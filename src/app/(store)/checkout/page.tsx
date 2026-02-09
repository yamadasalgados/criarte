"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import StoreNav from "@/components/StoreNav";
import { db, auth } from "@/lib/firebaseClient";
import { normalizeName, sha256Hex } from "@/lib/crypto";
import { yen } from "@/lib/money";
import { readCart, clearCart, cartTotals, type CartItem } from "@/lib/cart";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
} from "firebase/auth";
import { getLang, onLangChanged, t, type Lang } from "@/lib/i18n";

function isMobileBrowser() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

const phoneDigitsOnly = (s: string) => String(s || "").replace(/[^\d]/g, "");

export default function CheckoutPage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");

  const [lang, setLangState] = useState<Lang>("pt");
  useEffect(() => {
    setLangState(getLang());
    const off = onLangChanged(setLangState);
    return () => off();
  }, []);

  const [googleUser, setGoogleUser] = useState<{uid: string, email: string | null, photo: string | null} | null>(null);

  useEffect(() => {
    setMounted(true);
    setItems(readCart());

    (async () => {
      try { await getRedirectResult(auth); } catch { /* ignore */ }
    })();

    const off = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setGoogleUser(null);
        return;
      }
      setGoogleUser({
        uid: u.uid,
        email: u.email,
        photo: u.photoURL
      });
      if (!name.trim()) setName(u.displayName || "");
    });

    return () => off();
  }, [name]);

  const totals = useMemo(() => cartTotals(items), [items]);

  const loginGoogle = async () => {
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      if (isMobileBrowser()) {
        await signInWithRedirect(auth, provider);
        return;
      }
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      alert(e?.message || t("checkout_alert_create_error", lang));
    } finally {
      setBusy(false);
    }
  };

  const placeOrder = async () => {
    if (items.length === 0) return alert(t("checkout_alert_empty", lang));

    const nameTrim = name.trim();
    const phoneTrim = phone.trim();
    const pinTrim = pin.trim();

    if (!nameTrim || !phoneTrim || !/^\d{4}$/.test(pinTrim)) {
      return alert(t("checkout_alert_fill", lang));
    }

    const phoneNorm = phoneDigitsOnly(phoneTrim);
    if (phoneNorm.length < 8 || phoneNorm.length > 15) {
      return alert(t("checkout_alert_phone_invalid", lang));
    }

    setBusy(true);
    try {
      const pinHash = await sha256Hex(pinTrim);
      const nameLower = normalizeName(nameTrim);

      const orderRef = await addDoc(collection(db, "orders"), {
        status: "pending",
        customerUid: googleUser?.uid || null,
        customerPhoneNorm: phoneNorm,
        customer: {
          mode: googleUser ? "google+quick" : "quick",
          name: nameTrim,
          nameLower,
          phone: phoneTrim,
          phoneNorm,
          auth: googleUser ? { provider: "google", ...googleUser } : null
        },
        access: { pinHash },
        items: items.map(it => ({
          productId: it.productId,
          nameSnapshot: it.name,
          qty: it.qty,
          unitPriceSnapshot: it.unitPrice,
          unitCostSnapshot: it.unitCost,
          customText: it.customText || "",
        })),
        totals,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // API Login para sessão
      const loginRes = await fetch("/api/customer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNorm, pin: pinTrim }),
      });

      if (!loginRes.ok) throw new Error("Erro ao sincronizar sessão de chat.");

      clearCart();
      window.dispatchEvent(new CustomEvent("cart:changed"));
      window.location.href = `/chat?orderId=${orderRef.id}`;
    } catch (e: any) {
      alert(e?.message || "Erro ao finalizar pedido");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-app min-h-screen text-app font-sans">
      <StoreNav />

      <main className="mx-auto max-w-2xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-app">
            {t("checkout_title", lang)}
          </h1>
          <p className="text-muted text-sm">{t("checkout_tip", lang)}</p>
        </header>

        <div className="grid gap-6">
          
          {/* RESUMO DO PEDIDO */}
          <section className="rounded-3xl border border-app bg-card p-6 shadow-xl">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted mb-4">
              {t("checkout_summary_title", lang)}
            </h2>
            
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.lineId} className="flex justify-between items-start group">
                  <div className="flex-1 pr-4">
                    <p className="text-sm font-bold text-app group-hover:text-primary transition-colors">
                      {it.name} <span className="text-muted font-normal ml-1">x{it.qty}</span>
                    </p>
                    {it.customText && (
                      <p className="text-[11px] text-muted italic mt-1 bg-app/50 p-2 rounded-lg border border-app/50">
                        "{it.customText}"
                      </p>
                    )}
                  </div>
                  <span className="font-black text-sm text-app">{yen(it.unitPrice * it.qty)}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-app flex justify-between items-center">
              <span className="text-xs font-black uppercase text-muted tracking-widest">{t("total", lang)}</span>
              <span className="text-2xl font-black text-primary italic tracking-tighter">
                {yen(mounted ? totals.revenue : 0)}
              </span>
            </div>
          </section>

          {/* LOGIN GOOGLE (OPCIONAL) */}
          <section className={`rounded-3xl border transition-all p-6 ${googleUser ? 'border-primary/30 bg-primary/5' : 'border-app bg-card'}`}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                {t("checkout_google_title", lang)}
              </h2>
              {googleUser && <span className="bg-primary text-[rgb(var(--panel2))] text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Conectado</span>}
            </div>
            
            {googleUser ? (
              <div className="flex items-center gap-3 mt-3">
                {googleUser.photo && <img src={googleUser.photo} className="w-10 h-10 rounded-full border-2 border-primary" alt="Profile" />}
                <div>
                  <p className="text-sm font-bold text-app">{name}</p>
                  <p className="text-[10px] text-muted">{googleUser.email}</p>
                </div>
              </div>
            ) : (
              <button
                onClick={loginGoogle}
                disabled={busy}
                className="btn-secondary w-full mt-2 py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-card-muted transition-all border border-app text-xs font-black uppercase"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="" />
                {t("checkout_google_button", lang)}
              </button>
            )}
          </section>

          {/* FORMULÁRIO */}
          <section className="rounded-3xl border border-app bg-card p-6 space-y-5 shadow-xl">
            <div className="space-y-4">
              <div className="group">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1 ml-1 transition-colors group-focus-within:text-primary">
                  {t("checkout_name", lang)}
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-app border border-app rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary transition-all"
                />
              </div>

              <div className="group">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1 ml-1 transition-colors group-focus-within:text-primary">
                  {t("checkout_phone", lang)}
                </label>
                <input
                  type="tel"
                  value={phone}
                  placeholder={t("cust_phone_placeholder", lang)}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-app border border-app rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary transition-all"
                />
              </div>

              <div className="group">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1 ml-1 transition-colors group-focus-within:text-primary">
                  {t("checkout_pin", lang)} (4 dígitos)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  placeholder="••••"
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-full bg-app border border-app rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary tracking-widest transition-all"
                />
              </div>
            </div>

            <button
              disabled={busy || !mounted || items.length === 0}
              onClick={placeOrder}
              className="btn-primary w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {busy ? t("checkout_creating", lang) : t("checkout_create_button", lang)}
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}