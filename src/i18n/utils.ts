import { ui } from "./ui";
import type { Lang, UIKey } from "./ui";
import { PUBLIC_SITE } from "../lib/env";

// 站点支持的全部语言（en 为默认语言）
export const ALL_LANGS: Lang[] = ["en", "zh", "zh-TW", "de", "es", "fr", "ja", "ko", "ru"];

export function isLang(value: string | undefined): value is Lang {
  return ALL_LANGS.includes(value as Lang);
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

// 各语言对应的 BCP47 区域设置（用于日期格式化与 Open Graph locale）
export const BCP47_FOR_LANG: Record<Lang, string> = {
  en: "en-US",
  zh: "zh-CN",
  "zh-TW": "zh-TW",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
  ja: "ja-JP",
  ko: "ko-KR",
  ru: "ru-RU",
};

export function localeForLang(lang: Lang): string {
  return BCP47_FOR_LANG[lang];
}

// 将带语言前缀的 slug 还原为「翻译基 slug」。
// 例如 en-getting-started / zh-getting-started 都对应 getting-started，
// 这样在不同语言间切换时只需替换 URL 中的语言段即可命中同一篇文章。
// 注意：Astro 会把 content 集合的文件名 slug 统一小写，因此 zh-TW-*.mdx
// 的 slug 实为 zh-tw-...，这里用小写比较以避免大小写不匹配导致错误地
// 只剥掉 zh- 而留下 tw- 前缀。
export function baseSlug(slug: string): string {
  const lower = slug.toLowerCase();
  const sorted = [...ALL_LANGS].sort((a, b) => b.length - a.length);
  const prefix = sorted.find(
    (l) => lower === l.toLowerCase() || lower.startsWith(l.toLowerCase() + "-"),
  );
  return prefix ? slug.slice(prefix.length + 1) : slug;
}

// Open Graph 使用的下划线区域代码
export function ogLocaleForLang(lang: Lang): string {
  return BCP47_FOR_LANG[lang].replace("-", "_");
}

// 生成带语言前缀的相对路径（所有语言都带前缀，包括默认语言 en）。
// 原先依赖 astro:i18n 的 getRelativeLocaleUrl，但已在 astro.config 中
// 关闭 Astro 内置 i18n，故改为手动拼接，避免引入对内置 i18n 的依赖。
export function getRelativeLocaleUrl(
  lang: Lang,
  path = "",
  _opts?: { normalizeLocale?: boolean },
): string {
  const cleaned = path.startsWith("/") ? path.slice(1) : path;
  // file 输出格式：每个路由生成为直接的 .html 静态文件，URL 即文件本身
  // （/en.html、/en/docs.html、/en/blog.html、/en/docs/getting-started.html）。
  // 注意：Cloudflare Pages 的 Pretty URLs 会把 .html 规范重定向到无扩展名形式，
  // 必须在其仪表盘关闭 Pretty URLs，/xxx.html 才会以 200 直接命中静态文件。
  if (cleaned === "") return `/${lang}.html`;
  if (cleaned === "docs" || cleaned === "blog") return `/${lang}/${cleaned}.html`;
  return `/${lang}/${cleaned}.html`;
}

export function localizedPath(currentPath: string, target: Lang): string {
  const parts = currentPath.split("/").filter(Boolean);
  if (isLang(parts[0])) {
    parts[0] = target;
  } else {
    // 当前为非语言根路径（如根首页 /），补上目标语言与 .html
    return `/${target}.html`;
  }
  return "/" + parts.join("/");
}

export function absoluteUrl(path: string): string {
  const base = PUBLIC_SITE.replace(/\/$/, "");
  return path.startsWith("/") ? base + path : base + "/" + path;
}

// 供 SEOHead 生成 hreflang 交替链接（包含 x-default 指向英文版）。
export function alternateUrls(currentPath: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of ALL_LANGS) {
    map[l] = absoluteUrl(localizedPath(currentPath, l));
  }
  map["x-default"] = absoluteUrl(localizedPath(currentPath, "en"));
  return map;
}
