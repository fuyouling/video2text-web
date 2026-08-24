// 消除「逐个页面 301 重定向」的后处理脚本。
//
// 站点原本使用 Astro 默认的 build.format: "directory"，每个路由被生成为一个
// 目录 + index.html（如 dist/en/index.html）。Cloudflare Pages 对目录会自动
// 301 追加结尾斜杠（/en -> /en/），导致每个页面访问都被重定向。
//
// 现在的架构：build.format: "file"，路由生成为 .html 文件（如 dist/en.html），
// 直接命中、无需重定向。为了让 /en/ 与 /en/index.html 这两种历史/手写形式
// 也能无重定向访问，这里为每个语言页补一份 <name>/index.html 副本；并在站点
// 根目录直接放一份英文首页（index.html），使裸域 / 也无需重定向。
import { readdirSync, statSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const LANGS = ["en", "zh", "zh-TW", "de", "es", "fr", "ja", "ko", "ru"];
const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

if (!existsSync(distDir)) {
  console.error("no-redirect: dist/ not found, run `astro build` first.");
  process.exit(1);
}

function walk(dir, cb) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, cb);
    else cb(full);
  }
}

const htmlFiles = [];
walk(distDir, (f) => {
  if (f.endsWith(".html")) htmlFiles.push(f);
});

for (const file of htmlFiles) {
  const rel = file.slice(distDir.length + 1);
  // 顶层语言首页形如 en.html（无斜杠），需先剥掉 .html 再判断语言段。
  const topSeg = rel.split("/")[0].replace(/\.html$/, "");
  if (!LANGS.includes(topSeg)) continue;
  const base = rel.replace(/\.html$/, "");
  const target = join(distDir, base, "index.html");
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(file, target);
  console.log(`no-redirect: ${rel} -> ${base}/index.html`);
}

const enHome = join(distDir, "en.html");
const rootIndex = join(distDir, "index.html");
if (existsSync(enHome)) {
  copyFileSync(enHome, rootIndex);
  console.log("no-redirect: copied en.html -> index.html (root serves English directly)");
}
