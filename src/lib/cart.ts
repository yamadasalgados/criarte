export type CartItem = {
  lineId: string; // ✅ id único da linha do carrinho
  productId: string;
  name: string;
  photo?: string;
  unitPrice: number; // salePrice
  unitCost: number; // unitCost
  qty: number;

  // ✅ customização do cliente (texto livre)
  customText?: string;
};

const KEY = "criaarte_cart_v1";

function safeParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function makeLineId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function emitCartChanged() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event("cart:changed"));
  } catch {}
}

/** Lê carrinho e migra itens antigos (sem lineId) automaticamente */
export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  const raw = safeParse<any[]>(localStorage.getItem(KEY)) ?? [];

  const normalized: CartItem[] = raw
    .map((it) => {
      if (!it) return null;
      const lineId = String(it.lineId || "").trim() || makeLineId();
      const productId = String(it.productId || "").trim();
      if (!productId) return null;

      return {
        lineId,
        productId,
        name: String(it.name || ""),
        photo: it.photo ? String(it.photo) : undefined,
        unitPrice: Number(it.unitPrice || 0),
        unitCost: Number(it.unitCost || 0),
        qty: Math.max(1, Number(it.qty || 1)),
        customText: it.customText ? String(it.customText) : undefined,
      };
    })
    .filter(Boolean) as CartItem[];

  // grava já migrado (pra não dar inconsistência)
  try {
    localStorage.setItem(KEY, JSON.stringify(normalized));
  } catch {}

  return normalized;
}

export function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
  emitCartChanged(); // ✅ dispara evento (mesma aba)
}

export function clearCart() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  emitCartChanged(); // ✅ dispara evento (mesma aba)
}

/** ✅ SEMPRE adiciona uma nova linha (não sobrepõe) */
export function addLineItem(next: Omit<CartItem, "lineId">) {
  const items = readCart();
  const item: CartItem = { ...next, lineId: makeLineId(), qty: next.qty || 1 };
  items.push(item);
  writeCart(items); // ✅ já dispara evento
  return items;
}

export function removeLine(lineId: string) {
  const items = readCart().filter((x) => x.lineId !== lineId);
  writeCart(items); // ✅ já dispara evento
  return items;
}

export function setLineQty(lineId: string, qty: number) {
  const q = Math.max(1, Number(qty || 1));
  const items = readCart().map((x) => (x.lineId === lineId ? { ...x, qty: q } : x));
  writeCart(items); // ✅ já dispara evento
  return items;
}

export function cartTotals(items: CartItem[]) {
  const revenue = items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
  const cost = items.reduce((s, it) => s + it.unitCost * it.qty, 0);
  const profit = revenue - cost;
  return { revenue, cost, profit };
}
