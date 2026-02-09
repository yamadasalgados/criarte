"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import StoreNav from "@/components/StoreNav";
import { auth } from "@/lib/firebaseClient";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
} from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { getLang, onLangChanged, t, type Lang } from "@/lib/i18n";

/* ------------------ utils ------------------ */

function isMobileBrowser() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

function normalizePhoneBasic(input: string) {
  let d = String(input || "").replace(/[^\d]/g, "");
  if (d.startsWith("81") && d.length >= 10) d = "0" + d.slice(2);
  return d;
}

function safeSetCustomerSession(payload: { customerId: string; phone: string }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    "customer_session_v1",
    JSON.stringify({
      customerId: payload.customerId,
      phone: payload.phone,
      at: Date.now(),
    })
  );
}

async function safeReadJson(res: Response): Promise<any | null> {
  try {
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

type PhoneLogin = { phone: string; pin: string };

// ✅ NOVO: Componente interno que lida com useSearchParams e a lógica
function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const orderId = useMemo(() => String(sp.get("orderId") || "").trim(), [sp]);

  /* i18n */
  const [lang, setLangState] = useState<Lang>("pt");
  useEffect(() => {
    setLangState(getLang());
    const off = onLangChanged((l) => setLangState(l));
    return () => off();
  }, []);

  /* state */
  const [busy, setBusy] = useState(false);
  const [googleUid, setGoogleUid] = useState<string>("");
  const [googleEmail, setGoogleEmail] = useState<string>("");

  const [phoneLogin, setPhoneLogin] = useState<PhoneLogin>({ phone: "", pin: "" });

  const canPhoneLogin = useMemo(() => {
    const phoneNorm = normalizePhoneBasic(phoneLogin.phone);
    return phoneNorm.length >= 8 && String(phoneLogin.pin || "").trim().length === 4;
  }, [phoneLogin]);

  const handledGoogleLoginRef = useRef(false);

  /* ------------------ Google auth ------------------ */

  useEffect(() => {
    let alive = true;

    const finish = (targetOrderId?: string) => {
      const oid = String(targetOrderId || orderId || "").trim();
      if (oid) router.replace(`/chat?orderId=${encodeURIComponent(oid)}`);
      else router.replace("/customer/home");
    };

    const loginGoogleOnServer = async (idToken: string) => {
      const res = await fetch("/api/customer/login-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ idToken }),
      });
      const data = await safeReadJson(res);
      if (!res.ok || !data?.ok) return false;
      return true;
    };

    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!alive || !result?.user) return;
        if (handledGoogleLoginRef.current) return;
        handledGoogleLoginRef.current = true;
        const u = result.user;
        setGoogleUid(u.uid);
        setGoogleEmail(u.email || "");
        const idToken = await u.getIdToken();
        const ok = await loginGoogleOnServer(idToken);
        if (!ok) return;
        finish();
      } catch (e) {
        console.warn("getRedirectResult error", e);
      }
    })();

    const off = onAuthStateChanged(auth, async (u) => {
      if (!alive) return;
      if (!u) {
        setGoogleUid(""); setGoogleEmail("");
        return;
      }
      setGoogleUid(u.uid);
      setGoogleEmail(u.email || "");
      if (handledGoogleLoginRef.current) return;
      handledGoogleLoginRef.current = true;
      try {
        const idToken = await u.getIdToken();
        const ok = await loginGoogleOnServer(idToken);
        if (!ok) return;
        finish();
      } catch (e) {
        console.error("login-google exception", e);
      }
    });

    return () => { alive = false; off(); };
  }, [router, orderId]);

  const loginGoogle = async () => {
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      handledGoogleLoginRef.current = false;
      if (isMobileBrowser()) {
        await signInWithRedirect(auth, provider);
        return;
      }
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      alert(e?.message || t("cust_google_fail", lang));
    } finally {
      setBusy(false);
    }
  };

  const logoutGoogle = async () => {
    setBusy(true);
    try {
      await auth.signOut();
      setGoogleUid(""); setGoogleEmail("");
    } finally {
      setBusy(false);
    }
  };

  const loginWithPhonePin = async () => {
    const phoneNorm = normalizePhoneBasic(phoneLogin.phone);
    const pin = String(phoneLogin.pin || "").trim();
    if (!phoneNorm || !/^\d{4}$/.test(pin)) {
      alert(t("cust_login_error", lang));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/customer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          phone: phoneNorm,
          pin,
          ...(orderId ? { orderId } : {}),
        }),
      });
      const data = await safeReadJson(res);
      if (!res.ok || !data?.ok) {
        alert(data?.error || t("cust_login_error", lang));
        return;
      }
      safeSetCustomerSession({ customerId: phoneNorm, phone: phoneNorm });
      const targetOrderId = String(data?.orderId || orderId || "").trim();
      if (targetOrderId) router.replace(`/chat?orderId=${encodeURIComponent(targetOrderId)}`);
      else router.replace("/customer/home");
    } catch (e: any) {
      alert(e?.message || t("cust_login_error", lang));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("cust_login_title", lang)}</h1>
          <p className="mt-1 text-sm text-muted">{t("cust_login_subtitle", lang)}</p>
          {orderId && (
            <div className="mt-2 text-xs text-muted font-mono">
              Pedido #{orderId.slice(0, 8)}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-app bg-card p-4 shadow-sm">
        {googleUid ? (
          <div className="flex flex-col gap-3">
            <div className="text-sm text-muted">
              {t("cust_logged_as", lang)} <span className="font-mono">{googleEmail || googleUid}</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button disabled={busy} onClick={() => orderId ? router.push(`/chat?orderId=${encodeURIComponent(orderId)}`) : router.push("/customer/home")} className="btn-primary flex-1 px-4 py-3">
                {t("cust_enter", lang)}
              </button>
              <button disabled={busy} onClick={logoutGoogle} className="btn-ghost flex-1 px-4 py-3">
                {t("cust_logout_btn", lang)}
              </button>
            </div>
          </div>
        ) : (
          <button disabled={busy} onClick={loginGoogle} className="btn-primary w-full px-4 py-3">
            {busy ? t("cust_connecting_ellipsis", lang) : t("cust_google", lang)}
          </button>
        )}
      </div>

      <div className="my-4 text-center text-xs text-muted">{t("cust_or", lang)}</div>

      <div className="rounded-2xl border border-app bg-card p-4 shadow-sm">
        <div className="grid gap-3">
          <label className="text-sm">
            {t("cust_phone", lang)}
            <input className="input mt-1 w-full" placeholder={t("cust_phone_placeholder", lang)} value={phoneLogin.phone} onChange={(e) => setPhoneLogin(p => ({ ...p, phone: e.target.value }))} />
          </label>
          <label className="text-sm">
            {t("cust_pin", lang)}
            <input className="input mt-1 w-full" placeholder={t("cust_pin_placeholder", lang)} maxLength={4} inputMode="numeric" value={phoneLogin.pin} onChange={(e) => setPhoneLogin(p => ({ ...p, pin: e.target.value.replace(/[^\d]/g, "") }))} />
          </label>
          <button disabled={busy || !canPhoneLogin} onClick={loginWithPhonePin} className="btn-ghost w-full px-4 py-3">
            {busy ? t("cust_entering", lang) : t("cust_enter", lang)}
          </button>
        </div>
      </div>
    </main>
  );
}

// ✅ EXPORT PRINCIPAL: Envolve o conteúdo em Suspense
export default function CustomerLoginPage() {
  return (
    <div className="bg-app text-app min-h-screen">
      <StoreNav />
      <Suspense fallback={
        <div className="flex min-h-[60vh] items-center justify-center italic animate-pulse">
          Iniciando acesso...
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}