"use client";

import AdminGuard from "@/components/AdminGuard";
import Navbar from "@/components/Navbar";
import { auth, db } from "@/lib/firebaseClient";
import { yen } from "@/lib/money";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { use, useEffect, useMemo, useState } from "react";

type OrderDoc = any;

function StatusBadge({ status }: { status: string }) {
  const s = String(status || "pending").toLowerCase().trim();

  const map: Record<string, string> = {
    pending:
      "border-[rgb(var(--warning))] bg-[rgb(var(--warning))/0.10] text-[rgb(var(--warning))]",
    paid: "border-[rgb(var(--primary))] bg-[rgb(var(--primary))/0.10] text-[rgb(var(--primary))]",
    delivered:
      "border-[rgb(var(--info))] bg-[rgb(var(--info))/0.10] text-[rgb(var(--info))]",
    cancelled:
      "border-[rgb(var(--danger))] bg-[rgb(var(--danger))/0.10] text-[rgb(var(--danger))]",
  };

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
        map[s] || "border-app bg-card text-muted"
      }`}
    >
      {s}
    </span>
  );
}

function getItemCustomization(it: any): string {
  const candidates = [
    it?.customText,
    it?.customizationText,
    it?.customization,
    it?.customizationNote,
    it?.note,
    it?.notes,
    it?.personalizacao,
    it?.personalizacaoDescricao,
    it?.personalization,
    it?.personalizationNote,
  ]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);

  return candidates[0] || "";
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
 * ✅ Comprime imagem no browser para evitar estourar limite do servidor.
 * - converte para JPEG (mais leve)
 * - reduz tamanho max (ex: 1400px)
 * - qualidade default 0.82
 */
async function compressImageToDataUrl(
  file: File,
  opts?: { maxSide?: number; quality?: number }
): Promise<string> {
  const maxSide = opts?.maxSide ?? 1400;
  const quality = opts?.quality ?? 0.82;

  // Se já for pequeno, manda direto (evita perder qualidade)
  if (file.size <= 900_000) {
    return fileToDataUrl(file);
  }

  const imgUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Falha ao carregar imagem"));
      el.src = imgUrl;
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    let tw = w;
    let th = h;

    if (Math.max(w, h) > maxSide) {
      const scale = maxSide / Math.max(w, h);
      tw = Math.round(w * scale);
      th = Math.round(h * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas não disponível");

    ctx.drawImage(img, 0, 0, tw, th);

    // JPEG quase sempre menor que PNG
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return dataUrl;
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: orderId } = use(params);

  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [loading, setLoading] = useState(true);

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "paid" | "delivered" | "cancelled" | "send">(null);

  // ✅ foto admin
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const snap = await getDoc(doc(db, "orders", orderId));
    setOrder(snap.exists() ? (snap.data() as any) : null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // ⚠️ Seu Firestore rules atual BLOQUEIA admin ler orders/messages direto do client,
  // mas você disse que admin está recebendo -> então isso deve estar ok no seu ambiente.
  // Se em algum momento quebrar, a gente migra essa leitura pra API também.
  useEffect(() => {
    const qy = query(collection(db, "orders", orderId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(qy, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return () => unsub();
  }, [orderId]);

  const status = String(order?.status || "pending");
  const totals = order?.totals || { revenue: 0, cost: 0, profit: 0 };

  const createdAtText = useMemo(() => {
    const t = order?.createdAt?.toDate?.();
    return t ? t.toLocaleString() : "-";
  }, [order]);

  const paidAtText = useMemo(() => {
    const t = order?.paidAt?.toDate?.();
    return t ? t.toLocaleString() : null;
  }, [order]);

  const markPaid = async () => {
    if (status === "paid") return;
    if (!confirm("Confirmar que você RECEBEU o pagamento desse pedido?")) return;

    setBusy("paid");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Admin não logado");

      const token = await user.getIdToken();

      const res = await fetch(`/api/admin/orders/${orderId}/mark-paid`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Falha ao marcar como pago");

      await load();
    } catch (e: any) {
      alert(e?.message || "Erro ao marcar como pago");
    } finally {
      setBusy(null);
    }
  };

  const markDelivered = async () => {
    if (!confirm("Marcar como ENTREGUE?")) return;

    setBusy("delivered");
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "delivered",
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await load();
    } catch (e: any) {
      alert(e?.message || "Erro ao marcar como entregue");
    } finally {
      setBusy(null);
    }
  };

  const markCancelled = async () => {
    if (!confirm("Cancelar este pedido?")) return;

    setBusy("cancelled");
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await load();
    } catch (e: any) {
      alert(e?.message || "Erro ao cancelar pedido");
    } finally {
      setBusy(null);
    }
  };

  const pickPhoto = async (file: File | null) => {
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview("");
      return;
    }

    // preview rápido (não comprimido)
    setPhotoFile(file);
    try {
      const preview = await fileToDataUrl(file);
      setPhotoPreview(preview);
    } catch {
      setPhotoPreview("");
    }
  };

  const send = async () => {
    const t = text.trim();
    if (!t && !photoFile) return;

    setBusy("send");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Admin não logado");

      // ✅ IMPORTANTE: isso é o que faz o route reconhecer como admin
      const token = await user.getIdToken(true);

      let imageDataUrl: string | null = null;

      if (photoFile) {
        // ✅ comprime antes de enviar (evita 413 / 3MB etc)
        imageDataUrl = await compressImageToDataUrl(photoFile, {
          maxSide: 1400,
          quality: 0.82,
        });
      }

      // limpa UI rápido
      setText("");
      setPhotoFile(null);
      setPhotoPreview("");

      const res = await fetch("/api/customer/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // ✅ ESSENCIAL
        },
        body: JSON.stringify({
          text: t,
          imageDataUrl,
          orderId, // ✅ admin precisa indicar qual pedido
        }),
      });

      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json() : null;

      if (res.status === 413) {
        throw new Error(data?.error || "Imagem grande demais. Tente uma foto menor.");
      }

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Falha ao enviar mensagem");
      }
    } catch (e: any) {
      alert(e?.message || "Erro ao enviar mensagem");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <AdminGuard>
        <Navbar />
        <div className="mx-auto max-w-5xl px-4 py-10 text-muted">Carregando…</div>
      </AdminGuard>
    );
  }

  if (!order) {
    return (
      <AdminGuard>
        <Navbar />
        <div className="mx-auto max-w-5xl px-4 py-10 text-muted">Pedido não encontrado.</div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div className="bg-app text-app min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold text-app">Pedido</h1>
              <div className="mt-1 text-xs text-muted">
                <span className="font-mono">{orderId}</span> • criado em {createdAtText}
              </div>
              {paidAtText ? (
                <div className="mt-1 text-xs text-[rgb(var(--primary))]">pago em {paidAtText}</div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge status={status} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* INFO */}
            <div className="rounded-2xl border border-app bg-card p-4 shadow-sm">
              <div className="font-semibold text-app">Cliente</div>
              <div className="mt-2 text-sm text-muted">
                <b className="text-app">{order.customer?.name || "-"}</b> • {order.customer?.phone || "-"}
              </div>

              <div className="mt-4 grid gap-2 rounded-xl border border-app bg-card-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Total</span>
                  <b className="text-app">{yen(totals.revenue)}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Custo (estimado)</span>
                  <b className="text-app">{yen(totals.cost)}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Lucro (estimado)</span>
                  <b className="text-app">{yen(totals.profit)}</b>
                </div>
                <div className="text-xs text-muted">
                  * Lucro estimado considera custo por unidade cadastrado no produto.
                </div>
              </div>

              <div className="mt-4 text-sm text-muted">
                Status atual: <b className="text-app">{status}</b>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {status !== "paid" && (
                  <button
                    disabled={busy === "paid"}
                    onClick={markPaid}
                    className="rounded-xl bg-[rgb(var(--primary))] px-3 py-2 text-sm font-semibold text-[rgb(var(--panel2))] hover:brightness-110 disabled:opacity-60"
                  >
                    {busy === "paid" ? "Processando…" : "Marcar como pago"}
                  </button>
                )}

                <button
                  disabled={busy === "delivered"}
                  onClick={markDelivered}
                  className="rounded-xl border border-app bg-card px-3 py-2 text-sm hover:brightness-110 disabled:opacity-60"
                >
                  {busy === "delivered" ? "Salvando…" : "Marcar como entregue"}
                </button>

                <button
                  disabled={busy === "cancelled"}
                  onClick={markCancelled}
                  className="rounded-xl border border-[rgb(var(--danger))] bg-[rgb(var(--danger))/0.06] px-3 py-2 text-sm text-[rgb(var(--danger))] hover:brightness-110 disabled:opacity-60"
                >
                  {busy === "cancelled" ? "Salvando…" : "Cancelar"}
                </button>
              </div>

              <div className="mt-6">
                <div className="font-semibold text-app">Itens</div>
                <div className="mt-2 space-y-2">
                  {(order.items || []).map((it: any, idx: number) => {
                    const custom = getItemCustomization(it);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-xl border border-app bg-card-muted p-3 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-app truncate">{it.nameSnapshot}</div>
                          <div className="text-xs text-muted">qtd: {it.qty}</div>

                          {custom ? (
                            <div className="mt-1 text-xs text-app">
                              <span className="text-muted">Personalização: </span>
                              <span className="whitespace-pre-wrap break-words">{custom}</span>
                            </div>
                          ) : null}
                        </div>

                        <div className="text-right">
                          <div className="text-app">
                            {yen((it.unitPriceSnapshot || 0) * (it.qty || 0))}
                          </div>
                          <div className="text-xs text-muted">
                            custo: {yen((it.unitCostSnapshot || 0) * (it.qty || 0))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* CHAT */}
            <div className="rounded-2xl border border-app bg-card p-4 shadow-sm">
              <div className="font-semibold text-app">Chat do pedido</div>

              <div className="mt-3 h-[420px] overflow-y-auto rounded-xl border border-app bg-card-muted p-3">
                {messages.length === 0 ? (
                  <div className="text-sm text-muted">Sem mensagens ainda.</div>
                ) : (
                  <div className="space-y-2">
                    {messages.map((m) => {
                      const mine = m.senderRole === "admin";
                      const img = typeof m.imageUrl === "string" ? m.imageUrl : "";
                      const txt = String(m.text || "");

                      return (
                        <div
                          key={m.id}
                          className={[
                            "max-w-[85%] rounded-2xl px-3 py-2 text-sm border",
                            mine
                              ? "ml-auto border-[rgb(var(--primary))] bg-[rgb(var(--primary))/0.10]"
                              : "mr-auto border-app bg-card",
                          ].join(" ")}
                        >
                          {txt ? <div className="whitespace-pre-wrap text-app">{txt}</div> : null}

                          {img ? (
                            <div className="mt-2 overflow-hidden rounded-xl border border-app bg-card-muted">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={img}
                                alt="imagem enviada"
                                className="max-h-[280px] w-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          ) : null}

                          <div className="mt-1 text-[10px] text-muted">{m.senderRole}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {photoPreview ? (
                <div className="mt-3 rounded-2xl border border-app bg-card-muted p-3">
                  <div className="text-xs font-semibold text-muted">Pré-visualização</div>
                  <div className="mt-2 overflow-hidden rounded-xl border border-app bg-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="preview" className="max-h-[260px] w-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => pickPhoto(null)}
                    className="mt-2 rounded-xl border border-app bg-card px-3 py-2 text-sm hover:brightness-110"
                  >
                    Remover foto
                  </button>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Escreva…"
                  className="input flex-1 min-w-[180px] rounded-xl px-3 py-2"
                />

                <label className="rounded-xl border border-app bg-card px-3 py-2 text-sm cursor-pointer hover:brightness-110 flex items-center gap-2">
                  Foto
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      pickPhoto(f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>

                <button
                  disabled={busy === "send" || (!text.trim() && !photoFile)}
                  onClick={send}
                  className="rounded-xl bg-[rgb(var(--primary))] px-4 py-2 text-sm font-semibold text-[rgb(var(--panel2))] hover:brightness-110 disabled:opacity-60"
                >
                  {busy === "send" ? "Enviando…" : "Enviar"}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}
