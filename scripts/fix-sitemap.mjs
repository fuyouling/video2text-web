// 修正 @astrojs/sitemap 在 file 输出格式下生成的索引式 URL：
// 集成输出的是无扩展名的干净路径（如 /en/blog/star-on-github、/en/docs/index），
// 但本站 file 格式的真实文件均带 .html（/en/blog/star-on-github.html、
// /en/docs/index.html）。此脚本把每个 <loc> 改写为直接指向 .html 文件，
// 使 sitemap 与站内 canonical、内部链接保持一致。根路径（以 / 结尾）不处理。
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

for (const f of files) {
  const p = join(distDir, f);
  let xml = readFileSync(p, "utf8");
  xml = xml.replace(/<loc>([^<]+)<\/loc>/g, (_, url) => {
    if (url.endsWith("/")) return `<loc>${url}</loc>`;
    let u = url;
    if (u.endsWith("/index")) {
      u = u.slice(0, -"index".length) + "index.html";
    } else if (!/\.[a-z0-9]+$/i.test(u)) {
      u = u + ".html";
    }
    return `<loc>${u}</loc>`;
  });
  writeFileSync(p, xml);
  console.log(`fix-sitemap: ${f} updated`);
}
