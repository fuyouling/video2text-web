// 规范化 @astrojs/sitemap 在 directory + trailingSlash: "always" 下的 URL。
//
// Astro sitemap 集成对带 slug 的路由可能输出无末尾 / 的形式（如 /en/docs/getting-started），
// 但本站真实文件位于 dist/<lang>/<path>/index.html，对外 URL 必须显式以 / 结尾，
// 才能与 Cloudflare Pages 强制 Pretty URLs 的访问形式一致、避免 GSC
// "Page with redirect" 报错。
//
// 需要同时处理：
//   1) 每个 <url> 的 <loc>
//   2) i18n 注入的 <xhtml:link rel="alternate" hreflang=".." href=".."/> 交替链接
//
// 根路径（以 / 结尾）保持不变；非语言根路径（例如 /api/…）保持不变。
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
if (!existsSync(distDir)) {
  console.error("fix-sitemap: dist/ not found, run `astro build` first.");
  process.exit(1);
}

const files = readdirSync(distDir).filter((f) => /^sitemap(-\d+)?\.xml$/.test(f));
if (files.length === 0) {
  console.error("fix-sitemap: no sitemap-*.xml found");
  process.exit(0);
}

const LANGS = ["en", "zh", "zh-TW", "de", "es", "fr", "ja", "ko", "ru"];
const LANGS_RE = new RegExp(`^/(?:${LANGS.join("|")})(?:/|$)`);

// 把 path-only 形式（不带扩展名 / 不带末尾 /）规范化为带末尾 / 的目录形式。
// 仅对站内语言段下的 URL 做处理；其他路径保持原样。
function ensureTrailingSlash(u) {
  if (u.endsWith("/")) return u;
  // 已是文件形式（如 sitemap.xml 或 xhtml:link 指向 sitemap）保持原样
  if (/\.[a-z0-9]+$/i.test(u)) return u;
  // 非语言根路径（如 /api）保持原样
  if (!LANGS_RE.test(u)) return u;
  return u + "/";
}

for (const f of files) {
  const p = join(distDir, f);
  let xml = readFileSync(p, "utf8");
  xml = xml.replace(/<loc>([^<]+)<\/loc>/g, (_, url) => {
    return `<loc>${ensureTrailingSlash(url)}</loc>`;
  });
  xml = xml.replace(/href="([^"]+)"/g, (_, url) => {
    return `href="${ensureTrailingSlash(url)}"`;
  });
  writeFileSync(p, xml);
  console.log(`fix-sitemap: ${f} updated`);
}