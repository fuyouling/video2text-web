// 修复 GSC "网页包含重定向 (Page with redirect)" 报错。
//
// 本站采用 Astro build.format: "directory" + trailingSlash: "always"，
// 每个路由打包为 dist/<lang>/<path>/index.html（如
// dist/en/index.html、dist/en/blog/index.html、
// dist/en/docs/getting-started/index.html）。Cloudflare Pages 强制开启
// Pretty URLs，所有 URL 必须以 / 结尾才能直接命中目录索引文件。任何
// 不带末尾 / 或残留 .html 的内部 URL 都会被 Cloudflare 308 到目录形式，
// 触发多重重定向链，导致 GSC 报 "Page with redirect"。
//
// 本脚本在 `astro build` 之后扫描 dist/ 下所有 .html，把指向站内已知
// 语言段 (en/zh/zh-TW/de/es/fr/ja/ko/ru) 的内部 URL 规范化为「以 / 结尾
// 的目录形式」，并按 dist/ 中的实际目录结构校验；不存在的路径保持原样
// （保守策略，避免误伤）。
//
// 不会改写：
//   - 外链绝对 URL（http(s)://、mailto:、tel:）
//   - 已带文件扩展名的资源（/_astro/、/favicon.ico、/og/、/images/、/sitemap*.xml）
//   - 站内锚点 (#xxx) 与查询串 (?…=…&…)
//   - JSON-LD @type/@context 等非 URL 字段（按属性过滤：仅 href 与 content）
//
// 运行：node scripts/fix-internal-links.mjs
// 依赖：与 astro build 相同的 Node ≥ 18，无需第三方包。
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
if (!existsSync(distDir)) {
  console.error("fix-internal-links: dist/ not found, run `astro build` first.");
  process.exit(1);
}

const LANGS = ["en", "zh", "zh-TW", "de", "es", "fr", "ja", "ko", "ru"];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (st.isFile()) out.push(p);
  }
  return out;
}

// 1) 索引 dist/ 下所有可被 URL 直接命中的目录（每个目录含 index.html），
//    建立 "/en/" → "en" 与 "/en/blog/" → "en/blog" 的查找表。
const htmlFiles = walk(distDir).filter((p) => p.endsWith(".html"));
const urlToDir = new Map();
for (const abs of htmlFiles) {
  const rel = relative(distDir, abs).split(sep).join("/");
  // 根目录的 index.html → /
  if (rel === "index.html") {
    urlToDir.set("/", "");
    continue;
  }
  // 只把目录下的 index.html 视作"可被目录 URL 命中"的文件
  if (!rel.endsWith("/index.html")) continue;
  const dirRel = rel.slice(0, -"index.html".length); // "en/" 或 "en/blog/"
  const urlPath = "/" + dirRel; // "/en/" 或 "/en/blog/"
  if (!urlToDir.has(urlPath)) urlToDir.set(urlPath, dirRel);
}

// 2) 工具：把候选 path-only URL 规范化为"以 / 结尾的目录形式"。
//    仅当 (a) 以 / 开头、(b) 不带文件扩展名、(c) 在站内语言段下、
//    (d) 在 dist/ 索引中找到对应目录时才改写。
//    .html 残留会被剥掉（来自旧 file 格式链接或 astro 内置 i18n 的输出）。
function normalizeUrl(u) {
  if (!u) return u;
  let frag = "";
  let query = "";
  let pathPart = u;
  const hashIdx = pathPart.indexOf("#");
  if (hashIdx !== -1) {
    frag = pathPart.slice(hashIdx);
    pathPart = pathPart.slice(0, hashIdx);
  }
  const qIdx = pathPart.indexOf("?");
  if (qIdx !== -1) {
    query = pathPart.slice(qIdx);
    pathPart = pathPart.slice(0, qIdx);
  }
  if (!pathPart.startsWith("/")) return u;
  // 站内语言段下若残留 .html（来自历史 file 格式构建产物或 astro 内置 i18n），
  // 先剥掉扩展名后再判断是否"已带非 .html 扩展名的资源"。
  let stripped = pathPart;
  if (/\.html?$/i.test(stripped)) stripped = stripped.slice(0, stripped.length - 5);
  const lastSeg = stripped.split("/").pop() || "";
  // 已带其他文件扩展名（/_astro/、/favicon.ico、/og/、/images/、/sitemap*.xml）
  // 的资源保持原样，不处理
  if (/\.[a-z0-9]+$/i.test(lastSeg)) return u;
  const segs = stripped.split("/").filter(Boolean);
  if (segs.length === 0) return u; // "/" 已是根，直接返回
  if (!LANGS.includes(segs[0])) return u;

  // 1) 强制末尾 /
  let normalized = stripped.endsWith("/") ? stripped.slice(0, -1) : stripped;
  normalized += "/";

  // 仅当 dist/ 索引中存在该目录时才改写（保守）
  if (!urlToDir.has(normalized)) return u;
  return normalized + query + frag;
}

// 3) 扫描所有 .html，匹配 href="…"、href='…'、content="…"（canonical /
//    og:url / JSON-LD url），对站内 path-only 形式与站内绝对 URL 都执行
//    规范化；外链、已带扩展名资源、#、? 锚点保持原样。
const ATTR_RE = /(href|content)\s*=\s*("([^"]*)"|'([^']*)')/g;
const LANGS_RE = new RegExp(`^/(?:${LANGS.join("|")})(?:/|$)`);
const ABS_RE = /^https?:\/\/[^/]+(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i;

let touchedFiles = 0;
let touchedAttrs = 0;

for (const abs of htmlFiles) {
  const original = readFileSync(abs, "utf8");
  let changed = false;
  const replaced = original.replace(ATTR_RE, (match, attr, _quoted, dq, sq) => {
    const val = dq !== undefined ? dq : sq;
    if (typeof val !== "string") return match;

    let next = val;

    if (val.startsWith("/")) {
      if (!LANGS_RE.test(val)) return match;
      const last = val.split("#")[0].split("?")[0].split("/").pop() || "";
      // 已带非 .html 扩展名的资源（/_astro/、/favicon.ico 等）保持原样；
      // .html 残留（来自历史 file 格式构建产物）会被 normalizeUrl 剥掉并
      // 校验 dist/ 索引，只有命中真实目录才改写。
      if (/\.[a-z0-9]+$/i.test(last) && !/\.html?$/i.test(last)) return match;
      next = normalizeUrl(val);
    } else if (ABS_RE.test(val)) {
      // 对站内绝对 URL：若 pathname 是带 .html 的站内语言段路径，剥 .html 并校验。
      const m = val.match(ABS_RE);
      const origin = val.slice(
        0,
        val.length - (m[1] || "").length - (m[2] || "").length - (m[3] || "").length,
      );
      const pathPart = m[1] || "/";
      const query = m[2] || "";
      const frag = m[3] || "";
      if (!LANGS_RE.test(pathPart)) return match;
      const rewritten = normalizeUrl(pathPart);
      if (rewritten === pathPart) return match;
      next = origin + rewritten + query + frag;
    } else {
      return match;
    }

    if (next === val) return match;
    changed = true;
    touchedAttrs++;
    const quote = dq !== undefined ? '"' : "'";
    return `${attr}=${quote}${next}${quote}`;
  });
  if (changed) {
    writeFileSync(abs, replaced);
    touchedFiles++;
    console.log(`fix-internal-links: ${relative(distDir, abs)}`);
  }
}

console.log(
  `fix-internal-links: ${touchedFiles} file(s), ${touchedAttrs} attribute(s) rewritten`,
);