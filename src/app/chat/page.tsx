"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { auth } from "@/lib/firebaseClient";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import StoreNav from "@/components/StoreNav";
import { yen } from "@/lib/money";
import { getLang, onLangChanged, t, type Lang } from "@/lib/i18n";

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

const LS_PHONE = "cust_phone";
const LS_PIN = "cust_pin";

function normPhone(s: string) {
  return String(s || "").replace(/[^\d]/g, "");
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

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem"));
    img.src = dataUrl;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Falha ao ler arquivo"));
    r.onload = () => resolve(String(r.result || ""));
    r.readAsDataURL(file);
  });
}

/**
 * Comprime/redimensiona a imagem para evitar payload gigante em base64.
 */
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

// ✅ detecta mobile browser pra usar redirect (popup é instável no mobile)
function isMobileBrowser() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

export default function CustomerChatPage() {
  const [lang, setLangState] = useState<Lang>("pt");
  const [logged, setLogged] = useState(false);

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");

  const [busy, setBusy] = useState(false);

  const [photoDataUrl, setPhotoDataUrl] = useState<string>("");
  const [photoPreview, setPhotoPreview] = useState<string>("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const L = useMemo(() => {
    return {
      title: t("cust_chat_title", lang),
      subtitle: t("cust_chat_subtitle", lang),
      phone: t("cust_phone", lang),
      pin: t("cust_pin", lang),
      phonePh: t("cust_phone_placeholder", lang),
      pinPh: t("cust_pin_placeholder", lang),
      enter: t("cust_enter", lang),
      entering: t("cust_entering", lang),
      google: t("cust_google", lang),
      connecting: t("cust_connecting", lang),
      tip: t("cust_tip", lang),
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
      loginError: t("cust_login_error", lang),
      itemCustom: t("item_custom", lang),

      // mensagens internas (fallback)
      sendFail:
        lang === "ja"
          ? "送信に失敗しました。もう一度お試しください。"
          : lang === "en"
          ? "Failed to send. Please try again."
          : "Falha ao enviar. Tente novamente.",

      photoTooBig:
        lang === "ja"
          ? "画像が大きすぎます。別の写真を選んでください。"
          : lang === "en"
          ? "Image is too large. Please choose another photo."
          : "Imagem muito grande. Tente outra foto.",
    };
  }, [lang]);

  const scrollToBottom = () => {
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    );
  };

  const statusUi = useMemo(() => {
    const s = String(order?.status || "").toLowerCase().trim();
    if (s === "paid")
      return {
        label: t("status_paid", lang),
        tone: "good",
        hint: t("hint_paid", lang),
      };
    if (s === "delivered")
      return {
        label: t("status_delivered", lang),
        tone: "good",
        hint: t("hint_delivered", lang),
      };
    if (s === "cancelled" || s === "canceled")
      return {
        label: t("status_cancelled", lang),
        tone: "bad",
        hint: t("hint_cancelled", lang),
      };
    if (s === "confirmed")
      return {
        label: t("status_confirmed", lang),
        tone: "good",
        hint: t("hint_confirmed", lang),
      };
    return {
      label: t("status_pending", lang),
      tone: "neutral",
      hint: t("hint_pending", lang),
    };
  }, [order?.status, lang]);

  const badgeClass =
    statusUi.tone === "good"
      ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))/0.12] text-[rgb(var(--primary))]"
      : statusUi.tone === "bad"
      ? "border-[rgb(var(--danger))] bg-[rgb(var(--danger))/0.10] text-[rgb(var(--danger))]"
      : "border-app bg-card text-muted";

  const fetchState = async () => {
    const res = await fetch("/api/customer/messages");
    if (!res.ok) return;

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return;

    const data = await res.json();
    if (!data.ok) return;

    setOrder(data.order || null);
    setMessages(data.messages || []);
  };

  const tryCookieSession = async () => {
    try {
      const res = await fetch("/api/customer/messages");
      if (!res.ok) return false;

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) return false;

      const data = await res.json();
      if (!data.ok) return false;

      setLogged(true);
      setOrder(data.order || null);
      setMessages(data.messages || []);
      return true;
    } catch {
      return false;
    }
  };

  const loginWithPhonePin = async (p: string, k: string) => {
    const res = await fetch("/api/customer/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: p, pin: k }),
    });

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json"))
      return { ok: false, error: "Erro inesperado no login" };

    return await res.json();
  };

  useEffect(() => {
    setLangState(getLang());
    const offLang = onLangChanged((l) => setLangState(l));

    (async () => {
      // ✅ 1) Se voltou do Redirect do Google, finaliza aqui
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const idToken = await result.user.getIdToken();

          const res = await fetch("/api/customer/login-google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });

          const ct = res.headers.get("content-type") || "";
          if (!ct.includes("application/json")) {
            alert("Erro inesperado no login Google");
          } else {
            const data = await res.json();
            if (!data.ok) {
              alert(data.error || "Falha no login Google");
            } else {
              setLogged(true);
              await fetchState();
              return;
            }
          }
        }
      } catch (e: any) {
        const msg = String(e?.message || "");
        // Ignora cancelamento comum do usuário
        if (!/cancel|popup closed|user cancelled|user canceled/i.test(msg)) {
          alert(msg || "Falha ao finalizar login Google");
        }
      }

      // ✅ 2) tenta sessão cookie
      const ok = await tryCookieSession();
      if (ok) return;

      // ✅ 3) tenta phone/pin salvo
      try {
        const p = localStorage.getItem(LS_PHONE) || "";
        const k = localStorage.getItem(LS_PIN) || "";
        if (p) setPhone(p);
        if (k) setPin(k);

        if (p && k) {
          const data = await loginWithPhonePin(p, k);
          if (data.ok) {
            setLogged(true);
            await fetchState();
          }
        }
      } catch {}
    })();

    return () => offLang();
  }, []);

  useEffect(() => {
    if (!logged) return;
    const tmr = setInterval(fetchState, 2000);
    return () => clearInterval(tmr);
  }, [logged]);

  useEffect(() => {
    if (!logged) return;
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, logged]);

  const login = async () => {
    const p = normPhone(phone);
    const k = String(pin || "").trim();

    if (!p || !/^\d{4}$/.test(k)) return alert(L.loginError);

    setBusy(true);
    try {
      const data = await loginWithPhonePin(p, k);
      if (!data.ok) return alert(data.error || "Falha no login");

      try {
        localStorage.setItem(LS_PHONE, p);
        localStorage.setItem(LS_PIN, k);
      } catch {}

      setLogged(true);
      await fetchState();
    } finally {
      setBusy(false);
    }
  };

  const loginGoogle = async () => {
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      // ✅ Mobile = Redirect (mais confiável)
      if (isMobileBrowser()) {
        await signInWithRedirect(auth, provider);
        return;
      }

      // ✅ Desktop = Popup
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken();

      const res = await fetch("/api/customer/login-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json"))
        return alert("Erro inesperado no login Google");

      const data = await res.json();
      if (!data.ok) return alert(data.error || "Falha no login Google");

      setLogged(true);
      await fetchState();
    } catch (e: any) {
      alert(e?.message || "Falha no login Google");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/customer/logout", { method: "POST" });

    try {
      localStorage.removeItem(LS_PHONE);
      localStorage.removeItem(LS_PIN);
    } catch {}

    try {
      await auth.signOut();
    } catch {}

    setLogged(false);
    setOrder(null);
    setMessages([]);
    setText("");
    setPhotoDataUrl("");
    setPhotoPreview("");
  };

  const canSend = useMemo(() => {
    return text.trim().length > 0 || !!photoDataUrl;
  }, [text, photoDataUrl]);

  const itemsLines = useMemo(() => {
    const its = order?.items;
    if (Array.isArray(its) && its.length > 0) {
      return its
        .map((it) => {
          const name = String(it.nameSnapshot || it.name || "").trim();
          const qty =
            typeof it.qty === "number" && Number.isFinite(it.qty)
              ? it.qty
              : Number(it.qty || 0) || 0;
          const custom = String(
            it.customText || it.note || it.customization || ""
          ).trim();

          const left = [name || "Item", qty ? `x${qty}` : ""]
            .filter(Boolean)
            .join(" ");
          if (!custom) return left;
          return `${left} — ${L.itemCustom}: ${custom}`;
        })
        .filter(Boolean);
    }

    const summary = String(order?.itemsSummary || "").trim();
    return summary ? [summary] : [L.items];
  }, [order?.items, order?.itemsSummary, L.itemCustom, L.items]);

  const pickPhoto = async (file: File | null) => {
    if (!file) {
      setPhotoDataUrl("");
      setPhotoPreview("");
      return;
    }

    setBusy(true);
    try {
      const compressed = await compressImageToJpegDataUrl(file, {
        maxSide: 1280,
        quality: 0.78,
      });

      if (compressed.length > 1_800_000) {
        const smaller = await compressImageToJpegDataUrl(file, {
          maxSide: 900,
          quality: 0.7,
        });
        if (smaller.length > 1_800_000) {
          alert(L.photoTooBig);
          setPhotoDataUrl("");
          setPhotoPreview("");
          return;
        }
        setPhotoDataUrl(smaller);
        setPhotoPreview(smaller);
        return;
      }

      setPhotoDataUrl(compressed);
      setPhotoPreview(compressed);
    } catch (e: any) {
      alert(e?.message || "Falha ao preparar a imagem");
      setPhotoDataUrl("");
      setPhotoPreview("");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!canSend || busy) return;

    const tmsg = text.trim();
    const img = photoDataUrl || null;

    setText("");
    setPhotoDataUrl("");
    setPhotoPreview("");

    setBusy(true);
    try {
      const res = await fetch("/api/customer/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: tmsg, imageDataUrl: img }),
      });

      if (!res.ok) {
        let detail = "";
        try {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const j = await res.json();
            detail = j?.error ? `\n${j.error}` : "";
          }
        } catch {}
        alert(`${L.sendFail}${detail}`);
        return;
      }

      await fetchState();
    } catch (e: any) {
      alert(e?.message || L.sendFail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-app text-app min-h-screen">
      <StoreNav />

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-app">{L.title}</h1>
        <p className="mt-1 text-sm text-muted">{L.subtitle}</p>

        {!logged ? (
          <div className="mt-6 grid gap-3 rounded-2xl border border-app bg-card p-4 shadow-sm">
            <label className="text-sm text-app">
              {L.phone}
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input mt-1 w-full rounded-xl px-3 py-2"
                placeholder={L.phonePh}
              />
            </label>

            <label className="text-sm text-app">
              {L.pin}
              <input
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                className="input mt-1 w-full rounded-xl px-3 py-2"
                placeholder={L.pinPh}
              />
            </label>

            <button
              disabled={busy}
              onClick={login}
              className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? L.entering : L.enter}
            </button>

            <div className="my-1 h-px bg-[rgb(var(--border))]" />

            <button
              disabled={busy}
              onClick={loginGoogle}
              className="btn-ghost rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? L.connecting : L.google}
            </button>

            <div className="text-xs text-muted">{L.tip}</div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-app bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-app">{L.messages}</div>
              <button onClick={logout} className="btn-ghost rounded-xl px-3 py-2 text-sm">
                {L.logout}
              </button>
            </div>

            {/* CARD PEDIDO */}
            <div className="mt-3 rounded-2xl border border-app bg-card-muted p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-app">
                  {L.order}
                  {order?.customerName ? (
                    <span className="text-muted"> • {order.customerName}</span>
                  ) : null}
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass}`}
                >
                  {statusUi.label}
                </span>
              </div>

              <div className="mt-2 space-y-1 text-sm text-muted">
                {itemsLines.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap break-words">
                    • {line}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-muted">
                  {L.createdAt}:{" "}
                  <span className="font-mono">
                    {formatDateAny(order?.createdAt)}
                  </span>
                </div>
                <div className="text-lg font-bold text-[rgb(var(--primary))]">
                  {yen(Number(order?.total || 0))}
                </div>
              </div>

              <div className="mt-2 text-xs text-muted">{statusUi.hint}</div>
            </div>

            {/* CHAT */}
            <div className="mt-3 h-[420px] overflow-y-auto rounded-xl border border-app bg-card-muted p-3">
              {messages.length === 0 ? (
                <div className="text-sm text-muted">{L.noMessages}</div>
              ) : (
                <div className="space-y-2">
                  {messages.map((m) => {
                    const mine = m.senderRole === "customer";
                    const timeText = m.createdAt ? formatDateAny(m.createdAt) : "";
                    const img = m.imageUrl || m.imageDataUrl;

                    return (
                      <div
                        key={m.id}
                        className={[
                          "max-w-[85%] rounded-2xl px-3 py-2 text-sm border",
                          mine
                            ? "ml-auto border-[rgb(var(--primary))] bg-[rgb(var(--primary))/0.12]"
                            : "mr-auto border-app bg-card",
                        ].join(" ")}
                      >
                        {m.text ? (
                          <div className="whitespace-pre-wrap text-app">{m.text}</div>
                        ) : null}

                        {img ? (
                          <div className="mt-2 overflow-hidden rounded-xl border border-app bg-card-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt="photo" className="max-h-[260px] w-full object-cover" />
                          </div>
                        ) : null}

                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted">
                          <span>{m.senderRole}</span>
                          <span className="font-mono">{timeText}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* PREVIEW */}
            {photoPreview ? (
              <div className="mt-3 rounded-2xl border border-app bg-card-muted p-3">
                <div className="text-xs font-semibold text-muted">{L.photoPreview}</div>
                <div className="mt-2 overflow-hidden rounded-xl border border-app bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="preview" className="max-h-[260px] w-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => pickPhoto(null)}
                  className="btn-ghost mt-2 rounded-xl px-3 py-2 text-sm"
                >
                  {L.removePhoto}
                </button>
              </div>
            ) : null}

            {/* COMPOSER RESPONSIVO */}
            <div className="mt-3 rounded-2xl border border-app bg-card p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={L.write}
                  className="input w-full rounded-xl px-3 py-2 sm:flex-1"
                />

                <div className="flex gap-2">
                  <label
                    className="btn-ghost inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm cursor-pointer whitespace-nowrap"
                    title={L.pickPhoto}
                  >
                    {busy ? "..." : L.pickPhoto}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        pickPhoto(f);
                        e.currentTarget.value = "";
                      }}
                      disabled={busy}
                    />
                  </label>

                  <button
                    disabled={!canSend || busy}
                    onClick={send}
                    className="btn-primary inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap disabled:opacity-60"
                  >
                    {busy ? "..." : L.send}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
