// 修正 @astrojs/sitemap 在 file 输出格式下生成的索引式 URL：
// 集成输出的是无扩展名的干净路径，但本站 file 格式的真实文件均带 .html。
// 需要同时修正两类地址：
//   1) 每个 <url> 的 <loc>（如 /en/blog/star-on-github、/en/docs/index）
//   2) 集成因 i18n 注入的 <xhtml:link rel="alternate" hreflang=".." href=".."/> 交替链接
// 使其全部直接指向 .html 文件，与站内 canonical、内部链接保持一致。
// 根路径（以 / 结尾）不处理。
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
if (!existsSync(distDir)) {
  console.error("fix-sitemap: dist/ not found, run `astro build` first.");
  process.exit(1);
}

const files = readdirSync(distDir).filter((f) => /^sitemap-\d+\.xml$/.test(f));
if (files.length === 0) {
  console.error("fix-sitemap: no sitemap-*.xml found");
  process.exit(0);
}

// 把无扩展名的干净 URL 改写为直接的 .html 文件地址
function fixUrl(u) {
  if (u.endsWith("/")) return u;
  if (u.endsWith("/index")) return u.slice(0, -"index".length) + "index.html";
  if (!/\.[a-z0-9]+$/i.test(u)) return u + ".html";
  return u;
}

for (const f of files) {
  const p = join(distDir, f);
  let xml = readFileSync(p, "utf8");
  xml = xml.replace(/<loc>([^<]+)<\/loc>/g, (_, url) => {
    return `<loc>${fixUrl(url)}</loc>`;
  });
  // 同时修正 xhtml:link 交替链接中的 href（i18n 注入，同样是无扩展名）
  xml = xml.replace(/href="([^"]+)"/g, (_, url) => {
    return `href="${fixUrl(url)}"`;
  });
  writeFileSync(p, xml);
  console.log(`fix-sitemap: ${f} updated`);
}
