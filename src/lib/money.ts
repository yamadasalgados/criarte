export function yen(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(v);
}
