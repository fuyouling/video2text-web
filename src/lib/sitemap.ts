// 单源站点地图：枚举全部静态路由 + 动态内容（blog/docs）。
// 被 src/pages/sitemap-index.xml.ts 与 src/pages/sitemap-0.xml.ts 共用，
// 确保 dist/ 中的 sitemap-index.xml / sitemap-0.xml 与开发/预览服务器的
// 实时输出完全一致（解决 @astrojs/sitemap 集成产物在 dev/preview 不可见
// 导致 /sitemap-index.xml 在本地 404 的问题）。
import { getCollection, type CollectionEntry } from "astro:content";
import { ALL_LANGS, baseSlug, localizedPath, absoluteUrl } from "../i18n/utils";
import type { Lang } from "../i18n/ui";

// 顶层静态路由（无 [lang] 段）：根首页 / 仅作为 alternate 锚点，
// 实际 <loc> 由首页自身负责（已在 index.astro 中渲染）。
const ROOT_PATH = "/";

// 单段路由：每种语言一个页面（与 src/lib/i18n-paths.getStaticPaths 一致）
const SINGLE_SEG_PATHS = [
  "",
  "blog",
  "changelog",
  "checkout",
  "contact",
  "docs",
  "login",
  "pricing",
  "privacy",
  "refund",
  "register",
  "terms",
];

// 不出现在 sitemap 中的私有 / 后端路径
const EXCLUDED_PREFIXES = ["/api", "/health", "/me", "/auth", "/license", "/webhooks"];

export interface SitemapUrl {
  // 无末尾 / 的内部 path（用于 build index），调用方自行补回 /。
  path: string;
}

function isExcluded(path: string): boolean {
  return EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

// 把一段 path 转为各语言下的 path（用于 hreflang alternate）
function localizedFamily(path: string): Record<Lang, string> {
  const map = {} as Record<Lang, string>;
  for (const l of ALL_LANGS) map[l] = localizedPath(path, l);
  return map;
}

export async function collectSitemapUrls(): Promise<SitemapUrl[]> {
  const urls: SitemapUrl[] = [];

  // 1) 根首页 /
  if (!isExcluded(ROOT_PATH)) urls.push({ path: ROOT_PATH });

  // 2) 单段路由 × 所有语言
  for (const seg of SINGLE_SEG_PATHS) {
    for (const lang of ALL_LANGS) {
      const p = seg === "" ? `/${lang}/` : `/${lang}/${seg}/`;
      if (!isExcluded(p)) urls.push({ path: p });
    }
  }

  // 3) blog 详情 × 所有语言
  const blog = await getCollection("blog");
  const blogGroups = new Map<string, Partial<Record<Lang, CollectionEntry<"blog">>>>();
  for (const p of blog) {
    if (p.data.draft) continue;
    const base = baseSlug(p.slug);
    if (!blogGroups.has(base)) blogGroups.set(base, {});
    blogGroups.get(base)![p.data.lang] = p;
  }
  for (const base of blogGroups.keys()) {
    for (const lang of ALL_LANGS) {
      const p = `/${lang}/blog/${base}/`;
      if (!isExcluded(p)) urls.push({ path: p });
    }
  }

  // 4) docs 详情 × 所有语言
  const docs = await getCollection("docs");
  const docsGroups = new Map<string, Partial<Record<Lang, CollectionEntry<"docs">>>>();
  for (const d of docs) {
    const base = baseSlug(d.slug);
    if (!docsGroups.has(base)) docsGroups.set(base, {});
    docsGroups.get(base)![d.data.lang] = d;
  }
  for (const base of docsGroups.keys()) {
    for (const lang of ALL_LANGS) {
      const p = `/${lang}/docs/${base}/`;
      if (!isExcluded(p)) urls.push({ path: p });
    }
  }

  return urls;
}

// 给定内部 path 集合，生成 xhtml:link alternate 块（同 base 内容的多语言版本）。
// 关键：alternate 链接必须与"同 base 内容"在其它语言下的 URL 配对；
// 因此对每一组（同 base 段）独立计算。SINGLE_SEG_PATHS 的每段、blog/docs
// 每个 base slug 在所有语言下都存在（[lang]/X.astro 与 [...slug].astro 的
// getStaticPaths 已为每种语言各生成一页），故可统一处理。
export function buildAlternateHreflangs(
  path: string,
  site: URL | undefined,
): string {
  const base = (site ?? new URL("https://video2text.dpdns.org")).href.replace(/\/$/, "");
  const family = localizedFamily(path);
  const xhtmlNs = "http://www.w3.org/1999/xhtml";
  const lines: string[] = [];
  for (const [lang, lp] of Object.entries(family)) {
    lines.push(
      `    <xhtml:link rel="alternate" hreflang="${lang}" href="${base}${lp}"/>`,
    );
  }
  // x-default 指向英文版
  lines.push(
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${base}${family.en}"/>`,
  );
  return lines.join("");
}

// 暴露 absoluteUrl 给 API route 复用
export { absoluteUrl };
