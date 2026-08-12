import { getRelativeLocaleUrl as astroRelativeUrl } from "astro:i18n";
import { ui } from "./ui";
import type { Lang, UIKey } from "./ui";
import { PUBLIC_SITE } from "../lib/env";

export function isLang(value: string | undefined): value is Lang {
  return value === "en" || value === "zh";
}

export function getLangFromUrl(url: URL): Lang {
  const seg = url.pathname.split("/")[1];
  return isLang(seg) ? seg : "en";
}

export function useTranslations(lang: Lang): (key: UIKey) => string {
  return (key: UIKey): string => {
    const fromLang = ui[lang][key];
    if (fromLang) return fromLang;
    const fromEn = ui.en[key];
    if (fromEn) return fromEn;
    return key;
  };
}

export function getRelativeLocaleUrl(
  lang: Lang,
  path = "",
  opts?: { normalizeLocale?: boolean },
): string {
  const cleaned = path.startsWith("/") ? path.slice(1) : path;
  return astroRelativeUrl(lang, cleaned, opts);
}

export function localizedPath(currentPath: string, target: Lang): string {
  const parts = currentPath.split("/").filter(Boolean);
  if (isLang(parts[0])) {
    parts[0] = target;
  } else {
    parts.unshift(target);
  }
  return "/" + parts.join("/");
}

export function absoluteUrl(path: string): string {
  const base = PUBLIC_SITE.replace(/\/$/, "");
  return path.startsWith("/") ? base + path : base + "/" + path;
}

// 供 SEOHead 生成 hreflang 交替链接（包含 x-default 指向 /en）
export function alternateUrls(currentPath: string): { en: string; zh: string; xdefault: string } {
  const localized = localizedPath(currentPath, "en");
  return {
    en: absoluteUrl(localized),
    zh: absoluteUrl(localizedPath(currentPath, "zh")),
    xdefault: absoluteUrl("/en" + currentPath.replace(/^\/(en|zh)/, "")),
  };
}
