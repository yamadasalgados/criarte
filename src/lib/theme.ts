export type Theme = "dark" | "light";

const KEY = "criaarte_theme_v1";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const v = String(localStorage.getItem(KEY) || "").trim();
  return v === "light" || v === "dark" ? v : "dark";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent("theme:changed", { detail: { theme } }));
}

export function onThemeChanged(cb: (theme: Theme) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb(getTheme());
  window.addEventListener("theme:changed", handler as any);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("theme:changed", handler as any);
    window.removeEventListener("storage", handler);
  };
}

// ✅ chama uma vez no client pra garantir que o tema salvo seja aplicado
export function initTheme() {
  if (typeof window === "undefined") return;
  applyTheme(getTheme());
}
