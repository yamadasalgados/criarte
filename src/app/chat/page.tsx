"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { auth } from "@/lib/firebaseClient";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
} from "firebase/auth";
import StoreNav from "@/components/StoreNav";
import { yen } from "@/lib/money";
import { getLang, onLangChanged, t, type Lang } from "@/lib/i18n";
import { useRouter, useSearchParams } from "next/navigation";

// --- Tipagens e Helpers (mantidos como no seu original) ---

type Msg = {
  id: string;
  senderRole: "admin" | "customer";
  text?: string;
  createdAt?: any | null;
  imageUrl?: string;
  imageDataUrl?: string;
};

type OrderItem = {
  name?: string;
  qty?: number;
  customText?: string;
  note?: string;
  customization?: string;
  nameSnapshot?: string;
};

type OrderInfo = {
  id: string;
  status: string;
  itemsSummary?: string;
  total: number;
  customerName?: string;
  createdAt?: any | null;
  paidAt?: any | null;
  deliveredAt?: any | null;
  items?: OrderItem[];
};

type CustomerSession = {
  customerId: string;
  phone?: string;
  at?: number;
};

function isMobileBrowser() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

function formatDateAny(ts: any) {
  try {
    if (!ts) return "-";
    if (typeof ts?.toDate === "function")
      return ts.toDate().toISOString().slice(0, 16).replace("T", " ");
    if (ts instanceof Date)
      return ts.toISOString().slice(0, 16).replace("T", " ");
    return "-";
  } catch {
    return "-";
  }
}

// Funções de Imagem e Session omitidas aqui para brevidade, mas devem ser mantidas no seu arquivo original
// fileToDataUrl, compressImageToJpegDataUrl, readCustomerSession, etc.

function readCustomerSession(): CustomerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("customer_session_v1");
    if (!raw) return null;
    const j = JSON.parse(raw) as CustomerSession;
    if (!j?.customerId) return null;
    return j;
  } catch {
    return null;
  }
}

function clearCustomerSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("customer_session_v1");
}

async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error("Falha ao ler arquivo"));
      r.onload = () => resolve(String(r.result || ""));
      r.readAsDataURL(file);
    });
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Falha ao carregar imagem"));
      img.src = dataUrl;
    });
}

async function compressImageToJpegDataUrl(
    file: File,
    opts?: { maxSide?: number; quality?: number }
  ): Promise<string> {
    const maxSide = opts?.maxSide ?? 1280;
    const quality = opts?.quality ?? 0.78;
    const srcDataUrl = await fileToDataUrl(file);
    const img = await loadImageFromDataUrl(srcDataUrl);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    let targetW = w;
    let targetH = h;
    if (w >= h && w > maxSide) {
      targetW = maxSide;
      targetH = Math.round((h * maxSide) / w);
    } else if (h > w && h > maxSide) {
      targetH = maxSide;
      targetW = Math.round((w * maxSide) / h);
    }
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas não suportado");
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return canvas.toDataURL("image/jpeg", quality);
}

// ✅ NOVO: Componente interno que lida com a lógica do Chat
function ChatContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const orderId = (sp.get("orderId") || "").trim();

  const [lang, setLangState] = useState<Lang>("pt");
  const [authReady, setAuthReady] = useState(false);
  const [logged, setLogged] = useState(false);
  const [authMode, setAuthMode] = useState<"google" | "phone" | "none">("none");
  const [customerId, setCustomerId] = useState<string>(""); 
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string>("");
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLangState(getLang());
    const off = onLangChanged((l) => setLangState(l));
    return () => off();
  }, []);

  const L = useMemo(() => {
    return {
      title: t("cust_chat_title", lang),
      subtitle: t("cust_chat_subtitle", lang),
      google: t("cust_google", lang),
      connecting: t("cust_connecting", lang),
      logout: t("cust_logout", lang),
      messages: t("cust_messages", lang),
      order: t("cust_order", lang),
      items: t("cust_items", lang),
      createdAt: t("cust_created_at", lang),
      send: t("cust_send", lang),
      write: t("cust_write", lang),
      noMessages: t("cust_no_messages", lang),
      pickPhoto: t("cust_pick_photo", lang),
      removePhoto: t("cust_remove_photo", lang),
      photoPreview: t("cust_photo_preview", lang),
      itemCustom: t("item_custom", lang),
      pickOrder: lang === "ja" ? "注文を選択してください。" : lang === "en" ? "Please select an order." : "Selecione um pedido.",
      noOrder: lang === "ja" ? "この注文が見つかりません。" : lang === "en" ? "This order was not found." : "Este pedido não foi encontrado.",
      sendFail: lang === "ja" ? "送信に失敗しました。もう一度お試しください。" : lang === "en" ? "Failed to send. Please try again." : "Falha ao enviar. Tente novamente.",
      photoTooBig: lang === "ja" ? "画像が大きすぎます。別の写真を選んでください。" : lang === "en" ? "Image is too large. Please choose another photo." : "Imagem muito grande. Tente outra foto.",
      needLogin: lang === "ja" ? "チャットに入るにはログインが必要です。" : lang === "en" ? "You need to be logged in to access the chat." : "Você precisa estar logado para acessar o chat.",
      goLogin: lang === "ja" ? "ログインへ" : lang === "en" ? "Go to login" : "Ir para login",
      goHome: lang === "ja" ? "履歴へ" : lang === "en" ? "Go to history" : "Ir para histórico",
    };
  }, [lang]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  };

  const statusUi = useMemo(() => {
    const s = String(order?.status || "").toLowerCase().trim();
    if (s === "paid") return { label: t("status_paid", lang), tone: "good", hint: t("hint_paid", lang) };
    if (s === "delivered") return { label: t("status_delivered", lang), tone: "good", hint: t("hint_delivered", lang) };
    if (s === "cancelled" || s === "canceled") return { label: t("status_cancelled", lang), tone: "bad", hint: t("hint_cancelled", lang) };
    if (s === "confirmed") return { label: t("status_confirmed", lang), tone: "good", hint: t("hint_confirmed", lang) };
    return { label: t("status_pending", lang), tone: "neutral", hint: t("hint_pending", lang) };
  }, [order?.status, lang]);

  const badgeClass = statusUi.tone === "good"
      ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))/0.12] text-[rgb(var(--primary))]"
      : statusUi.tone === "bad"
      ? "border-[rgb(var(--danger))] bg-[rgb(var(--danger))/0.10] text-[rgb(var(--danger))]"
      : "border-app bg-card text-muted";

  const fetchState = async (mode?: "google" | "phone", cid?: string) => {
    if (!orderId) {
      setOrder(null);
      setMessages([]);
      return;
    }
    const m = mode || authMode;
    const c = cid || customerId;
    const url = m === "phone" && c
        ? `/api/customer/messages?orderId=${encodeURIComponent(orderId)}&customerId=${encodeURIComponent(c)}`
        : `/api/customer/messages?orderId=${encodeURIComponent(orderId)}`;

    const res = await fetch(url);
    if (!res.ok) return;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return;
    const data = await res.json();
    if (!data.ok) {
      setOrder(null);
      setMessages([]);
      return;
    }
    setOrder(data.order || null);
    setMessages(data.messages || []);
  };

  useEffect(() => {
    let alive = true;
    const sess = readCustomerSession();
    if (sess?.customerId) {
      setAuthMode("phone");
      setCustomerId(sess.customerId);
      setLogged(true);
      setAuthReady(true);
      fetchState("phone", sess.customerId).catch(() => {});
      return () => { alive = false; };
    }

    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!alive) return;
        if (result?.user) {
          const idToken = await result.user.getIdToken();
          await fetch("/api/customer/login-google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          }).catch(() => {});
        }
      } catch { }
    })();

    const offAuth = onAuthStateChanged(auth, async (u) => {
      if (!alive) return;
      setAuthReady(true);
      if (!u) {
        setAuthMode("none");
        setLogged(false);
        setOrder(null);
        setMessages([]);
        router.replace("/customer/login");
        return;
      }
      setAuthMode("google");
      setCustomerId("");
      setLogged(true);
      await fetchState("google", "");
    });

    return () => { alive = false; offAuth(); };
  }, [router, orderId]);

  useEffect(() => {
    if (!logged) return;
    const tmr = setInterval(() => fetchState().catch(() => {}), 2000);
    return () => clearInterval(tmr);
  }, [logged, orderId, authMode, customerId]);

  useEffect(() => {
    if (!logged) return;
    scrollToBottom();
  }, [messages.length, logged]);

  const loginGoogle = async () => {
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      if (isMobileBrowser()) {
        await signInWithRedirect(auth, provider);
        return;
      }
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken();
      await fetch("/api/customer/login-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      setAuthMode("google");
      setCustomerId("");
      setLogged(true);
      setAuthReady(true);
      await fetchState("google", "");
    } catch (e: any) {
      alert(e?.message || "Falha no login Google");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await fetch("/api/customer/logout", { method: "POST" }).catch(() => {});
      clearCustomerSession();
      setAuthMode("none");
      setCustomerId("");
      setLogged(false);
      setOrder(null);
      setMessages([]);
      setText("");
      setPhotoDataUrl("");
      setPhotoPreview("");
      router.replace("/customer/login");
    } finally {
      setBusy(false);
    }
  };

  const canSend = useMemo(() => text.trim().length > 0 || !!photoDataUrl, [text, photoDataUrl]);

  const itemsLines = useMemo(() => {
    const its = order?.items;
    if (Array.isArray(its) && its.length > 0) {
      return its.map((it) => {
          const name = String(it.nameSnapshot || it.name || "").trim();
          const qty = typeof it.qty === "number" ? it.qty : Number(it.qty || 0) || 0;
          const custom = String(it.customText || it.note || it.customization || "").trim();
          const left = [name || "Item", qty ? `x${qty}` : ""].filter(Boolean).join(" ");
          return custom ? `${left} — ${L.itemCustom}: ${custom}` : left;
        }).filter(Boolean);
    }
    const summary = String(order?.itemsSummary || "").trim();
    return summary ? [summary] : order ? [L.items] : [];
  }, [order, L.itemCustom, L.items]);

  const pickPhoto = async (file: File | null) => {
    if (!file) {
      setPhotoDataUrl("");
      setPhotoPreview("");
      return;
    }
    setBusy(true);
    try {
      const compressed = await compressImageToJpegDataUrl(file, { maxSide: 1280, quality: 0.78 });
      if (compressed.length > 1_800_000) {
        const smaller = await compressImageToJpegDataUrl(file, { maxSide: 900, quality: 0.7 });
        if (smaller.length > 1_800_000) {
          alert(L.photoTooBig);
          setPhotoDataUrl(""); setPhotoPreview("");
          return;
        }
        setPhotoDataUrl(smaller); setPhotoPreview(smaller);
        return;
      }
      setPhotoDataUrl(compressed); setPhotoPreview(compressed);
    } catch (e: any) {
      alert(e?.message || "Falha ao preparar a imagem");
      setPhotoDataUrl(""); setPhotoPreview("");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!orderId) return alert(L.pickOrder);
    if (!canSend || busy) return;
    const tmsg = text.trim();
    const img = photoDataUrl || null;
    setText(""); setPhotoDataUrl(""); setPhotoPreview("");
    setBusy(true);
    try {
      const body = authMode === "phone" && customerId
          ? { orderId, text: tmsg, imageDataUrl: img, customerId }
          : { orderId, text: tmsg, imageDataUrl: img };

      const res = await fetch("/api/customer/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        alert(L.sendFail);
        return;
      }
      await fetchState();
    } catch (e: any) {
      alert(e?.message || L.sendFail);
    } finally {
      setBusy(false);
    }
  };

  if (!authReady) {
    return (
      <div className="bg-app text-app min-h-screen">
        <StoreNav />
        <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted">
          {t("shop_loading", lang)}
        </main>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-app">{L.title}</h1>
            <p className="mt-1 text-sm text-muted">{L.subtitle}</p>
          </div>
          <button className="btn-ghost rounded-xl px-3 py-2 text-sm" onClick={() => router.push("/customer/orders")}>
            {L.goHome}
          </button>
        </div>

        {!logged ? (
          <div className="mt-6 rounded-2xl border border-app bg-card p-4 shadow-sm">
            <div className="text-sm text-muted">{L.needLogin}</div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button className="btn-primary flex-1 rounded-xl px-4 py-2 text-sm font-semibold" onClick={() => router.push("/customer/login")}>
                {L.goLogin}
              </button>
              <button disabled={busy} onClick={loginGoogle} className="btn-ghost flex-1 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
                {busy ? L.connecting : L.google}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-app bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-app">{L.messages}</div>
              <button onClick={logout} className="btn-ghost rounded-xl px-3 py-2 text-sm" disabled={busy}>
                {L.logout}
              </button>
            </div>

            {!orderId ? (
              <div className="mt-3 rounded-2xl border border-app bg-card-muted p-4">
                <div className="text-sm font-semibold text-app">Chat</div>
                <div className="mt-2 text-sm text-muted">{L.pickOrder}</div>
              </div>
            ) : !order ? (
              <div className="mt-3 rounded-2xl border border-app bg-card-muted p-4">
                <div className="text-sm font-semibold text-app">Chat</div>
                <div className="mt-2 text-sm text-muted">{L.noOrder}</div>
              </div>
            ) : (
              <>
                <div className="mt-3 rounded-2xl border border-app bg-card-muted p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-app">
                      {L.order} <span className="font-mono">#{orderId.slice(0, 8)}</span>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass}`}>
                      {statusUi.label}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-muted">
                    {itemsLines.map((line, idx) => <div key={idx}>• {line}</div>)}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-muted font-mono">{formatDateAny(order?.createdAt)}</div>
                    <div className="text-lg font-bold text-primary">{yen(order?.total || 0)}</div>
                  </div>
                </div>

                <div className="mt-3 h-[420px] overflow-y-auto rounded-xl border border-app bg-card-muted p-3">
                  <div className="space-y-2">
                    {messages.map((m) => {
                      const mine = m.senderRole === "customer";
                      const img = m.imageUrl || m.imageDataUrl;
                      return (
                        <div key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm border ${mine ? "ml-auto border-primary bg-primary/10" : "mr-auto border-app bg-card"}`}>
                          {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
                          {img && <img src={img} alt="msg" className="mt-2 max-h-[260px] rounded-xl object-cover" />}
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                </div>

                {photoPreview && (
                  <div className="mt-3 p-3 border border-app rounded-xl bg-card-muted">
                    <img src={photoPreview} alt="p" className="max-h-[200px] rounded-xl mb-2" />
                    <button onClick={() => pickPhoto(null)} className="text-xs text-danger uppercase font-black">{L.removePhoto}</button>
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <input value={text} onChange={(e) => setText(e.target.value)} placeholder={L.write} className="input flex-1" />
                  <label className="btn-ghost px-3 flex items-center cursor-pointer">
                    📷<input type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0] || null)} />
                  </label>
                  <button onClick={send} disabled={!canSend || busy} className="btn-primary px-4">SEND</button>
                </div>
              </>
            )}
          </div>
        )}
    </main>
  );
}

// ✅ COMPONENTE PRINCIPAL: Exporta o Suspense Boundary
export default function CustomerChatPage() {
  return (
    <div className="bg-app text-app min-h-screen">
      <StoreNav />
      <Suspense fallback={<div className="p-10 text-center animate-pulse italic uppercase font-black">Carregando Chat...</div>}>
        <ChatContent />
      </Suspense>
    </div>
  );
}