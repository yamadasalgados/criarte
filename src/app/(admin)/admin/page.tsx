"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";

/* ------------------ tiny utils ------------------ */

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmtYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yen(n: number) {
  try {
    return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(n || 0);
  } catch {
    return `¥${Math.round(n || 0)}`;
  }
}

function toDateSafe(t: any): Date | null {
  if (!t) return null;
  if (t instanceof Date) return t;
  if (typeof t?.toDate === "function") return t.toDate();
  if (typeof t === "number") return new Date(t);
  return null;
}

/* ------------------ lightweight charts (canvas) ------------------ */

function drawLineChart(opts: {
  canvas: HTMLCanvasElement;
  labels: string[];
  values: number[];
  title: string;
  valuePrefix?: string;
}) {
  const { canvas, labels, values, title, valuePrefix = "" } = opts;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, w, h);

  // theme-ish (read from CSS vars, fallback)
  const cs = getComputedStyle(document.documentElement);
  const fg = cs.getPropertyValue("--text")?.trim() || "rgba(255,255,255,0.92)";
  const muted = cs.getPropertyValue("--muted")?.trim() || "rgba(255,255,255,0.55)";
  const border = cs.getPropertyValue("--border")?.trim() || "rgba(255,255,255,0.12)";
  const primary = cs.getPropertyValue("--primary")?.trim() || "255 140 0";

  const padL = 38;
  const padR = 12;
  const padT = 28;
  const padB = 26;

  // title
  ctx.fillStyle = muted;
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText(title, 10, 16);

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);

  // grid (3 lines)
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = padT + ((h - padT - padB) * i) / 3;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
  }

  // y labels (top/mid/bot)
  ctx.fillStyle = muted;
  ctx.font = "10px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const topVal = max;
  const midVal = min + range / 2;
  const botVal = min;
  ctx.fillText(`${valuePrefix}${Math.round(topVal)}`, 8, padT + 3);
  ctx.fillText(`${valuePrefix}${Math.round(midVal)}`, 8, padT + (h - padT - padB) / 2 + 3);
  ctx.fillText(`${valuePrefix}${Math.round(botVal)}`, 8, h - padB + 3);

  const N = values.length;
  if (N === 0) return;

  const x0 = padL;
  const x1 = w - padR;
  const y0 = padT;
  const y1 = h - padB;

  const xStep = N === 1 ? 0 : (x1 - x0) / (N - 1);

  const toY = (v: number) => {
    const t = (v - min) / range;
    return y1 - t * (y1 - y0);
  };

  // line
  ctx.strokeStyle = `rgb(${primary})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = x0 + i * xStep;
    const y = toY(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // points
  ctx.fillStyle = `rgb(${primary})`;
  values.forEach((v, i) => {
    const x = x0 + i * xStep;
    const y = toY(v);
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // x labels (first/mid/last)
  ctx.fillStyle = muted;
  ctx.font = "10px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const first = labels[0] || "";
  const mid = labels[Math.floor((N - 1) / 2)] || "";
  const last = labels[N - 1] || "";
  ctx.fillText(first, x0, h - 8);
  ctx.fillText(mid, x0 + (x1 - x0) / 2 - 14, h - 8);
  ctx.fillText(last, x1 - 30, h - 8);
}

function drawBarChart(opts: {
  canvas: HTMLCanvasElement;
  labels: string[];
  values: number[];
  title: string;
}) {
  const { canvas, labels, values, title } = opts;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, w, h);

  const cs = getComputedStyle(document.documentElement);
  const muted = cs.getPropertyValue("--muted")?.trim() || "rgba(255,255,255,0.55)";
  const border = cs.getPropertyValue("--border")?.trim() || "rgba(255,255,255,0.12)";
  const primary = cs.getPropertyValue("--primary")?.trim() || "255 140 0";

  ctx.fillStyle = muted;
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText(title, 10, 16);

  const padL = 28;
  const padR = 12;
  const padT = 28;
  const padB = 26;

  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, h - padB);
  ctx.lineTo(w - padR, h - padB);
  ctx.stroke();

  const max = Math.max(...values, 1);
  const N = values.length;
  if (N === 0) return;

  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const gap = 10;
  const barW = clamp(innerW / N - gap, 12, 60);

  ctx.fillStyle = `rgb(${primary})`;
  values.forEach((v, i) => {
    const x = padL + i * (barW + gap);
    const bh = (v / max) * innerH;
    const y = padT + (innerH - bh);
    ctx.fillRect(x, y, barW, bh);
  });

  // labels
  ctx.fillStyle = muted;
  ctx.font = "10px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  labels.forEach((lab, i) => {
    const x = padL + i * (barW + gap);
    ctx.fillText(lab, x, h - 8);
  });
}

/* ------------------ page ------------------ */

export default function AdminHomePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [isLogged, setIsLogged] = useState(false);
  const [isAdminDoc, setIsAdminDoc] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  // charts state
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string>("");

  const [rev14Labels, setRev14Labels] = useState<string[]>([]);
  const [rev14Values, setRev14Values] = useState<number[]>([]);
  const [statusLabels, setStatusLabels] = useState<string[]>(["pending", "paid", "delivered", "cancelled"]);
  const [statusValues, setStatusValues] = useState<number[]>([0, 0, 0, 0]);

  const [cash30Labels, setCash30Labels] = useState<string[]>([]);
  const [cash30Values, setCash30Values] = useState<number[]>([]); // net/day

  const lineRevRef = useRef<HTMLCanvasElement | null>(null);
  const barStatusRef = useRef<HTMLCanvasElement | null>(null);
  const lineCashRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUid(null);
        setIsLogged(false);
        setIsAdminDoc(null);
        return;
      }

      setUid(u.uid);
      setIsLogged(true);

      try {
        const snap = await getDoc(doc(db, "admins", u.uid));
        setIsAdminDoc(snap.exists());
      } catch (e) {
        setIsAdminDoc(false);
      }
    });

    return () => unsub();
  }, []);

  const bootstrap = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/bootstrap", { method: "POST" });
      const data = await res.json();
      if (!data.ok) return alert(data.error || "Falha no bootstrap");
      alert("Admin ativado! Recarregando...");
      window.location.reload();
    } catch (e: any) {
      alert(e?.message || "Erro");
    } finally {
      setBusy(false);
    }
  };

  async function loadDashboardStats() {
    setLoadingStats(true);
    setStatsError("");

    try {
      // ---- Revenue last 14 days (orders) ----
      const now = new Date();
      const start14 = startOfDay(new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000)); // inclusive
      const endNow = now;

      const qOrders = query(
        collection(db, "orders"),
        where("createdAt", ">=", Timestamp.fromDate(start14)),
        where("createdAt", "<=", Timestamp.fromDate(endNow)),
        orderBy("createdAt", "desc"),
        limit(500)
      );

      const ordersSnap = await getDocs(qOrders);

      const mapDayRevenue = new Map<string, number>();
      const mapStatusCount: Record<string, number> = {
        pending: 0,
        paid: 0,
        delivered: 0,
        cancelled: 0,
      };

      ordersSnap.docs.forEach((d) => {
        const o: any = d.data();
        const st = String(o?.status || "pending").toLowerCase().trim();
        if (mapStatusCount[st] != null) mapStatusCount[st]++;

        const dt = toDateSafe(o?.createdAt);
        if (!dt) return;
        const key = fmtYMD(startOfDay(dt));
        const rev = Number(o?.totals?.revenue || 0) || 0;
        mapDayRevenue.set(key, (mapDayRevenue.get(key) || 0) + rev);
      });

      const labels14: string[] = [];
      const values14: number[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = fmtYMD(startOfDay(d));
        labels14.push(key.slice(5)); // MM-DD
        values14.push(mapDayRevenue.get(key) || 0);
      }

      setRev14Labels(labels14);
      setRev14Values(values14);

      setStatusValues([
        mapStatusCount.pending || 0,
        mapStatusCount.paid || 0,
        mapStatusCount.delivered || 0,
        mapStatusCount.cancelled || 0,
      ]);

      // ---- Cashflow last 30 days (cash_movements) ----
      const start30 = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
      const qCash = query(
        collection(db, "cash_movements"),
        where("createdAt", ">=", Timestamp.fromDate(start30)),
        where("createdAt", "<=", Timestamp.fromDate(endNow)),
        orderBy("createdAt", "desc"),
        limit(1000)
      );

      const cashSnap = await getDocs(qCash);
      const mapDayNet = new Map<string, number>();

      cashSnap.docs.forEach((d) => {
        const c: any = d.data();
        const dt = toDateSafe(c?.createdAt);
        if (!dt) return;
        const key = fmtYMD(startOfDay(dt));

        // aceita: type = "in"|"out" OU amount positivo/negativo
        const rawAmount = Number(c?.amount || 0) || 0;
        const type = String(c?.type || "").toLowerCase().trim();
        const signed =
          type === "out" ? -Math.abs(rawAmount) : type === "in" ? Math.abs(rawAmount) : rawAmount;

        mapDayNet.set(key, (mapDayNet.get(key) || 0) + signed);
      });

      const labels30: string[] = [];
      const values30: number[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = fmtYMD(startOfDay(d));
        labels30.push(key.slice(5)); // MM-DD
        values30.push(mapDayNet.get(key) || 0);
      }

      setCash30Labels(labels30);
      setCash30Values(values30);
    } catch (e: any) {
      setStatsError(e?.message || "Falha ao carregar gráficos");
    } finally {
      setLoadingStats(false);
    }
  }

  // load stats when admin is active
  useEffect(() => {
    if (isAdminDoc) {
      loadDashboardStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminDoc]);

  // draw charts
  useEffect(() => {
    if (!isAdminDoc) return;

    if (lineRevRef.current) {
      drawLineChart({
        canvas: lineRevRef.current,
        labels: rev14Labels,
        values: rev14Values,
        title: "Receita por dia (últimos 14 dias)",
        valuePrefix: "¥",
      });
    }

    if (barStatusRef.current) {
      drawBarChart({
        canvas: barStatusRef.current,
        labels: statusLabels,
        values: statusValues,
        title: "Pedidos por status (últimos 14 dias)",
      });
    }

    if (lineCashRef.current) {
      drawLineChart({
        canvas: lineCashRef.current,
        labels: cash30Labels,
        values: cash30Values.map((v) => Math.round(v)),
        title: "Fluxo de caixa líquido/dia (últimos 30 dias)",
        valuePrefix: "¥",
      });
    }
  }, [isAdminDoc, rev14Labels, rev14Values, statusLabels, statusValues, cash30Labels, cash30Values]);

  const rev14Total = useMemo(() => rev14Values.reduce((a, b) => a + (b || 0), 0), [rev14Values]);
  const cash30Total = useMemo(() => cash30Values.reduce((a, b) => a + (b || 0), 0), [cash30Values]);

  if (!isLogged) {
    return (
      <div className="bg-app text-app min-h-screen">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="rounded-2xl border border-app bg-card p-4 shadow-sm">
            <div className="text-lg font-semibold text-app">Admin</div>
            <div className="mt-2 text-sm text-muted">Faça login para acessar o painel.</div>

            <a
              href="/admin/login"
              className="mt-4 inline-block rounded-xl bg-[rgb(var(--primary))] px-4 py-2 text-sm font-semibold text-[rgb(var(--panel2))] hover:brightness-110"
            >
              Ir para login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-app text-app min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-bold text-app">Dashboard</h1>

        <div className="mt-4 rounded-2xl border border-app bg-card p-4 shadow-sm">
          <div className="text-sm text-muted">Seu UID (copie pro .env.local):</div>

          <div className="mt-2 rounded-xl border border-app bg-card-muted p-3 font-mono text-xs text-app">
            {uid || "—"}
          </div>

          <div className="mt-3 text-sm text-muted">
            Admin ativo (Firestore):{" "}
            <b className="text-app">{isAdminDoc === null ? "—" : isAdminDoc ? "SIM" : "NÃO"}</b>
          </div>

          {!isAdminDoc ? (
            <div className="mt-3 rounded-xl border border-[rgb(var(--warning))] bg-[rgb(var(--warning))/0.10] p-3 text-sm text-app">
              <b>Você ainda não foi ativado como Admin.</b>

              <div className="mt-1 text-xs text-muted">
                1) Coloque este UID no <span className="font-mono text-app">.env.local</span> em{" "}
                <span className="font-mono text-app">ADMIN_UID</span>
                <br />
                2) Reinicie o servidor (<span className="font-mono text-app">npm run dev</span>)
                <br />
                3) Clique no botão abaixo
              </div>

              <button
                disabled={busy}
                onClick={bootstrap}
                className="mt-3 rounded-xl bg-[rgb(var(--primary))] px-4 py-2 text-sm font-semibold text-[rgb(var(--panel2))] hover:brightness-110 disabled:opacity-60"
              >
                {busy ? "Ativando…" : "Ativar Admin (Bootstrap)"}
              </button>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <a
                  href="/admin/products"
                  className="rounded-2xl border border-app bg-card p-4 hover:brightness-110"
                >
                  <div className="font-semibold text-app">Produtos</div>
                  <div className="mt-1 text-sm text-muted">Cadastro + fotos + custos</div>
                </a>

                <a
                  href="/admin/orders"
                  className="rounded-2xl border border-app bg-card p-4 hover:brightness-110"
                >
                  <div className="font-semibold text-app">Pedidos</div>
                  <div className="mt-1 text-sm text-muted">Status + chat por pedido</div>
                </a>

                <a
                  href="/admin/cashflow"
                  className="rounded-2xl border border-app bg-card p-4 hover:brightness-110"
                >
                  <div className="font-semibold text-app">Fluxo de Caixa</div>
                  <div className="mt-1 text-sm text-muted">Entradas/saídas + saldo</div>
                </a>
              </div>

              {/* ✅ GRÁFICOS */}
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-app bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-muted">
                      Total 14d: <b className="text-app">{yen(rev14Total)}</b>
                    </div>

                    <button
                      onClick={loadDashboardStats}
                      disabled={loadingStats}
                      className="rounded-xl border border-app bg-card px-3 py-1.5 text-xs hover:brightness-110 disabled:opacity-60"
                    >
                      {loadingStats ? "Atualizando…" : "Atualizar"}
                    </button>
                  </div>

                  <div className="mt-3 h-[220px]">
                    <canvas ref={lineRevRef} className="h-full w-full" />
                  </div>

                  {statsError ? (
                    <div className="mt-2 text-xs text-[rgb(var(--danger))]">{statsError}</div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-app bg-card p-4">
                  <div className="text-sm text-muted">
                    Status (14d):{" "}
                    <b className="text-app">
                      {statusLabels.map((s, i) => `${s}:${statusValues[i] || 0}`).join(" • ")}
                    </b>
                  </div>

                  <div className="mt-3 h-[220px]">
                    <canvas ref={barStatusRef} className="h-full w-full" />
                  </div>
                </div>

                <div className="rounded-2xl border border-app bg-card p-4 lg:col-span-2">
                  <div className="text-sm text-muted">
                    Cash 30d (líquido):{" "}
                    <b className="text-app">{yen(cash30Total)}</b>
                  </div>

                  <div className="mt-3 h-[220px]">
                    <canvas ref={lineCashRef} className="h-full w-full" />
                  </div>

                  <div className="mt-2 text-xs text-muted">
                    * Se seu <span className="font-mono text-app">cash_movements</span> usa{" "}
                    <span className="font-mono text-app">type: "in" | "out"</span>, ele já interpreta.
                    Se não usa, ele soma o <span className="font-mono text-app">amount</span> como veio.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
