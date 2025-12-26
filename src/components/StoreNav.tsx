"use client";

import { useEffect, useMemo, useState } from "react";
import { readCart } from "@/lib/cart";
import { getLang, onLangChanged, setLang, t, type Lang } from "@/lib/i18n";
import Link from "next/link";
import { applyTheme, getTheme, initTheme, onThemeChanged, setTheme, type Theme } from "@/lib/theme";

function IconChat(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden="true">
      <path
        d="M7 8h10M7 12h7M5 20l2.2-2.2A8.5 8.5 0 1 1 20 12.5c0 4.7-3.8 8.5-8.5 8.5H5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCart(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden="true">
      <path
        d="M6 7h15l-1.2 7.2a2 2 0 0 1-2 1.6H9a2 2 0 0 1-2-1.6L5.5 4.5H3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM17.5 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconTheme(props: { className?: string; theme: Theme }) {
  // sun = light, moon = dark (mostra o ícone do tema atual pra indicar)
  if (props.theme === "light") {
    // sun
    return (
      <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden="true">
        <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  // moon
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden="true">
      <path
        d="M21 13.2A7.5 7.5 0 0 1 10.8 3 8.5 8.5 0 1 0 21 13.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function langLabel(lang: Lang) {
  return lang === "pt" ? "Português" : lang === "en" ? "English" : "日本語";
}
function langFlag(lang: Lang) {
  return lang === "pt" ? "🇧🇷" : lang === "en" ? "🇺🇸" : "🇯🇵";
}

function LangOption({
  lang,
  current,
  onPick,
}: {
  lang: Lang;
  current: Lang;
  onPick: (l: Lang) => void;
}) {
  const isActive = current === lang;
  return (
    <button
      type="button"
      onClick={() => onPick(lang)}
      className={[
        "w-full rounded-xl border px-3 py-3 text-left flex items-center justify-between gap-3",
        isActive ? "border-emerald-400/60 bg-emerald-500/10" : "border-app bg-card hover:brightness-[1.03]",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg" aria-hidden="true">
          {langFlag(lang)}
        </span>
        <div>
          <div className="text-sm font-semibold text-app">{langLabel(lang)}</div>
          <div className="text-xs text-muted">{lang}</div>
        </div>
      </div>

      {isActive ? (
        <span className="text-xs font-semibold text-emerald-600">{t("in_use", current)}</span>
      ) : (
        <span className="text-xs text-muted-2">{t("select", current)}</span>
      )}
    </button>
  );
}

function ThemeOption({
  theme,
  current,
  onPick,
  label,
  lang,
}: {
  theme: Theme;
  current: Theme;
  onPick: (t: Theme) => void;
  label: string;
  lang: Lang;
}) {
  const isActive = current === theme;
  return (
    <button
      type="button"
      onClick={() => onPick(theme)}
      className={[
        "w-full rounded-xl border px-3 py-3 text-left flex items-center justify-between gap-3",
        isActive ? "border-emerald-400/60 bg-emerald-500/10" : "border-app bg-card hover:brightness-[1.03]",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <span className="h-9 w-9 rounded-xl border border-app bg-card-muted flex items-center justify-center">
          <IconTheme theme={theme} className="h-5 w-5 text-app" />
        </span>
        <div>
          <div className="text-sm font-semibold text-app">{label}</div>
          <div className="text-xs text-muted">{theme}</div>
        </div>
      </div>

      {isActive ? (
        <span className="text-xs font-semibold text-emerald-600">{t("in_use", lang)}</span>
      ) : (
        <span className="text-xs text-muted-2">{t("select", lang)}</span>
      )}
    </button>
  );
}

export default function StoreNav() {
  const [lang, setLangState] = useState<Lang>("pt");
  const [cartCount, setCartCount] = useState(0);

  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [theme, setThemeState] = useState<Theme>("dark");

  const refreshCartCount = () => {
    const items = readCart();
    const totalQty = items.reduce((s, it) => s + Number(it.qty || 0), 0);
    setCartCount(totalQty);
  };

  useEffect(() => {
    // idioma
    setLangState(getLang());
    const offLang = onLangChanged((l) => setLangState(l));

    // tema
    initTheme();
    const th = getTheme();
    setThemeState(th);
    applyTheme(th);

    const offTheme = onThemeChanged((x) => {
      setThemeState(x);
      applyTheme(x);
    });

    // carrinho
    refreshCartCount();
    const onCart = () => refreshCartCount();
    window.addEventListener("cart:changed", onCart as any);
    window.addEventListener("storage", onCart);

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLangOpen(false);
        setThemeOpen(false);
      }
    };
    window.addEventListener("keydown", onEsc);

    return () => {
      offLang();
      offTheme();
      window.removeEventListener("cart:changed", onCart as any);
      window.removeEventListener("storage", onCart);
      window.removeEventListener("keydown", onEsc);
    };
  }, []);

  const labels = useMemo(() => {
    return {
      chat: t("chat", lang),
      cart: t("cart", lang),
      language: t("language", lang),
      theme: t("theme", lang),
    };
  }, [lang]);

  const pickLang = (l: Lang) => {
    setLang(l);
    setLangOpen(false);
  };

  const pickTheme = (x: Theme) => {
    setTheme(x);
    setThemeOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-app bg-card/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="CriArte" className="h-10 w-auto rounded-lg" />
        </Link>

        <div className="flex items-center gap-2">
          <a
            href="/chat"
            aria-label={labels.chat}
            title={labels.chat}
            className="h-10 w-10 rounded-2xl border border-app bg-card hover:brightness-[1.03] flex items-center justify-center text-app"
          >
            <IconChat className="h-5 w-5" />
          </a>

          <a
            href="/cart"
            aria-label={labels.cart}
            title={labels.cart}
            className="relative h-10 w-10 rounded-2xl border border-app bg-card hover:brightness-[1.03] flex items-center justify-center text-app"
          >
            <IconCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span
                className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-[rgb(var(--primary))] px-1.5 py-0.5 text-[11px] font-bold text-white text-center"
                aria-label={`${cartCount} item(s)`}
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </a>

          {/* Idioma */}
          <button
            type="button"
            onClick={() => setLangOpen(true)}
            aria-label={labels.language}
            title={labels.language}
            className="h-10 w-10 rounded-2xl border border-app bg-card hover:brightness-[1.03] flex items-center justify-center text-app"
          >
            <span className="text-lg leading-none" aria-hidden="true">
              {langFlag(lang)}
            </span>
          </button>

          {/* Tema */}
          <button
            type="button"
            onClick={() => setThemeOpen(true)}
            aria-label={labels.theme}
            title={labels.theme}
            className="h-10 w-10 rounded-2xl border border-app bg-card hover:brightness-[1.03] flex items-center justify-center text-app"
          >
            <IconTheme theme={theme} className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* MODAL IDIOMA */}
      {langOpen && (
        <div className="fixed inset-0 z-50 bg-black/55">
          <button
            type="button"
            aria-label={t("close", lang)}
            className="absolute inset-0"
            onClick={() => setLangOpen(false)}
          />
          <div className="relative z-10 flex min-h-full w-full items-start justify-center px-4 py-6 overflow-y-auto">
            <div className="w-full max-w-sm rounded-2xl border border-app bg-card p-4 shadow-xl max-h-[85vh] overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-app">{t("language", lang)}</div>
                  <div className="text-xs text-muted">{t("choose_language", lang)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setLangOpen(false)}
                  className="rounded-xl border border-app px-3 py-1.5 text-xs bg-card hover:brightness-[1.03] text-app"
                >
                  {t("close", lang)}
                </button>
              </div>

              <div className="mt-3 grid gap-2 overflow-y-auto pr-1 max-h-[60vh]">
                <LangOption lang="pt" current={lang} onPick={pickLang} />
                <LangOption lang="en" current={lang} onPick={pickLang} />
                <LangOption lang="ja" current={lang} onPick={pickLang} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TEMA */}
      {themeOpen && (
        <div className="fixed inset-0 z-50 bg-black/55">
          <button
            type="button"
            aria-label={t("close", lang)}
            className="absolute inset-0"
            onClick={() => setThemeOpen(false)}
          />
          <div className="relative z-10 flex min-h-full w-full items-start justify-center px-4 py-6 overflow-y-auto">
            <div className="w-full max-w-sm rounded-2xl border border-app bg-card p-4 shadow-xl max-h-[85vh] overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-app">{t("theme", lang)}</div>
                  <div className="text-xs text-muted">{t("choose_theme", lang)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setThemeOpen(false)}
                  className="rounded-xl border border-app px-3 py-1.5 text-xs bg-card hover:brightness-[1.03] text-app"
                >
                  {t("close", lang)}
                </button>
              </div>

              <div className="mt-3 grid gap-2 overflow-y-auto pr-1 max-h-[60vh]">
                <ThemeOption theme="light" current={theme} onPick={pickTheme} label={t("theme_light", lang)} lang={lang} />
                <ThemeOption theme="dark" current={theme} onPick={pickTheme} label={t("theme_dark", lang)} lang={lang} />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
