"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import StoreNav from "@/components/StoreNav";
import { db, auth } from "@/lib/firebaseClient";
import { normalizeName, normalizePhoneJP, sha256Hex } from "@/lib/crypto";
import { yen } from "@/lib/money";
import { readCart, clearCart, cartTotals, type CartItem } from "@/lib/cart";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getLang, onLangChanged, t, type Lang } from "@/lib/i18n";

const LS_PHONE = "cust_phone";
const LS_PIN = "cust_pin";

export default function CheckoutPage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");

  // ✅ i18n
  const [lang, setLangState] = useState<Lang>("pt");
  useEffect(() => {
    setLangState(getLang());
    const off = onLangChanged((l) => setLangState(l));
    return () => off();
  }, []);

  // ✅ Google opcional (pra “lembrar” em qualquer device)
  const [googleUid, setGoogleUid] = useState<string | null>(null);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setItems(readCart());

    const u = auth.currentUser;
    if (u?.uid) {
      setGoogleUid(u.uid);
      setGoogleEmail(u.email || null);
    }
  }, []);

  const totals = useMemo(() => cartTotals(items), [items]);

  const loginGoogle = async () => {
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);

      setGoogleUid(cred.user.uid);
      setGoogleEmail(cred.user.email || null);

      if (!name.trim()) setName(cred.user.displayName || "");
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

    const phoneNorm = normalizePhoneJP(phoneTrim);
    if (!phoneNorm || phoneNorm.length < 8) {
      return alert(t("checkout_alert_phone_invalid", lang));
    }

    const nameLower = normalizeName(nameTrim);
    const pinHash = await sha256Hex(pinTrim);

    setBusy(true);
    try {
      await addDoc(collection(db, "orders"), {
        status: "pending",
        customer: {
          mode: "quick",
          name: nameTrim,
          nameLower,
          phone: phoneTrim,
          phoneNorm,
          ...(googleUid
            ? {
                auth: {
                  provider: "google",
                  uid: googleUid,
                  email: googleEmail || null,
                },
              }
            : {}),
        },
        access: { pinHash },
        items: items.map((it) => ({
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

      // ✅ salva no aparelho (pra entrar automático)
      try {
        localStorage.setItem(LS_PHONE, phoneNorm);
        localStorage.setItem(LS_PIN, pinTrim);
      } catch {}

      // ✅ cria cookie session agora (7 dias)
      try {
        await fetch("/api/customer/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phoneNorm, pin: pinTrim }),
        });
      } catch {}

      // ✅ limpa carrinho
      clearCart();
      setItems([]);
      try {
        window.dispatchEvent(new CustomEvent("cart:changed"));
      } catch {}

      window.location.href = "/chat";
    } catch (e: any) {
      alert(e?.message || t("checkout_alert_create_error", lang));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-app text-app min-h-screen">
      <StoreNav />

      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-bold text-app">{t("checkout_title", lang)}</h1>

        <div className="mt-6 grid gap-3 rounded-2xl border border-app bg-card p-4 shadow-sm">
          {/* ✅ RESUMO DO CARRINHO */}
          <div className="rounded-2xl border border-app bg-card-muted p-3">
            <div className="text-sm font-semibold text-app">
              {t("checkout_summary_title", lang)}
            </div>

            {!mounted ? (
              <div className="mt-2 text-xs text-muted">{t("checkout_cart_loading", lang)}</div>
            ) : items.length === 0 ? (
              <div className="mt-2 text-xs text-[rgb(var(--danger))]">
                {t("checkout_cart_empty", lang)}
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {items.map((it) => (
                  <div key={it.lineId} className="rounded-xl border border-app bg-card p-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-app truncate">
                          {it.name} <span className="text-muted">x{it.qty}</span>
                        </div>

                        {it.customText ? (
                          <div className="mt-1 text-xs text-muted whitespace-pre-wrap break-words">
                            <span className="text-muted-2">
                              {t("checkout_customization_label", lang)}{" "}
                            </span>
                            <span className="text-app">{it.customText}</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="text-sm font-semibold text-app whitespace-nowrap">
                        {yen(it.unitPrice * it.qty)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-app pt-3">
              <span className="text-sm text-muted">{t("total", lang)}</span>
              <b className="text-lg text-app">{yen(mounted ? totals.revenue : 0)}</b>
            </div>
          </div>

          {/* ✅ Google opcional */}
          <div className="rounded-2xl border border-app bg-card-muted p-3">
            <div className="text-sm font-semibold text-app">{t("checkout_google_title", lang)}</div>
            <div className="mt-1 text-xs text-muted">{t("checkout_google_desc", lang)}</div>

            {googleUid ? (
              <div className="mt-2 text-sm text-app">
                <span className="font-semibold text-[rgb(var(--primary))]">
                  {t("checkout_google_connected", lang)}
                </span>{" "}
                <span className="text-muted">{googleEmail ? `(${googleEmail})` : ""}</span>
              </div>
            ) : (
              <button
                disabled={busy}
                onClick={loginGoogle}
                className="btn-ghost mt-3 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {busy ? t("checkout_google_connecting", lang) : t("checkout_google_button", lang)}
              </button>
            )}
          </div>

          {/* ✅ Campos */}
          <label className="text-sm text-muted">
            {t("checkout_name", lang)}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input mt-1 w-full rounded-xl px-3 py-2"
            />
          </label>

          <label className="text-sm text-muted">
            {t("checkout_phone", lang)}
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input mt-1 w-full rounded-xl px-3 py-2"
              placeholder={t("cust_phone_placeholder", lang)}
            />
          </label>

          <label className="text-sm text-muted">
            {t("checkout_pin", lang)}
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="input mt-1 w-full rounded-xl px-3 py-2"
              placeholder={t("cust_pin_placeholder", lang)}
            />
          </label>

          <button
            disabled={busy || !mounted || items.length === 0}
            onClick={placeOrder}
            className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? t("checkout_creating", lang) : t("checkout_create_button", lang)}
          </button>

          <div className="text-xs text-muted">{t("checkout_tip", lang)}</div>
        </div>
      </main>
    </div>
  );
}
