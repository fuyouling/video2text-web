import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";

// 默认开发/预览域名为 video2text.dpdns.org（Cloudflare 托管，免备案）。
// 生产独立域名通过 PUBLIC_SITE 构建期注入；不要在此写死最终域名。
export default defineConfig({
  site: process.env.PUBLIC_SITE || "https://video2text.dpdns.org",
  output: "static",
  // 采用 directory 输出格式：每个路由生成为 dist/<lang>/<path>/index.html
  // （如 dist/en.html/index.html、dist/en/blog/index.html、
  //   dist/en/docs/getting-started/index.html）。Cloudflare Pages 强制
  // 末尾 /，开启 Pretty URLs 时即把 dist/<dir>/index.html 直接以 200
  // 返回给 /<dir>/，零重定向；trailingSlash: "always" 保证所有站内
  // 链接、canonical、hreflang、sitemap 都以 / 结尾，避免任何 308。
  build: { format: "directory" },
  // trailingSlash: "always" 配合 directory 格式：所有路径段显式带末尾 /，
  // 直接命中 Cloudflare Pages 的目录索引文件。任何不带 / 的形式（如 /en）
  // 都会触发 308 → /en/，必须统一为 /en/。
  trailingSlash: "always",
  devToolbar: { enabled: false },
  integrations: [react(), mdx()],
  // 注意：站点地图由 src/pages/sitemap-index.xml.ts + sitemap-0.xml.ts
  // 两个 API route + src/lib/sitemap.ts 枚举器手写产出，确保 dev /
  // preview / 生产访问 /sitemap-index.xml 均为 200。原先使用
  // @astrojs/sitemap 集成直接写 dist/sitemap-*.xml 的方式会导致开发
  // / 预览服务器 404（集成产物不在 Astro 路由表内），故已弃用。
  // 注意：本站采用基于 [lang] 路径段 + 文件名语言前缀（如 zh-TW-*.mdx）
  // 的「手动」国际化方案，content 集合的 slug 由 baseSlug 处理。
  // 因此不要在此启用 Astro 内置 i18n，否则它会把以语言代码开头的
  // content slug（尤其是带地区的 zh-TW-*）自动改写并生成错误的 tw-* 副本路由。
  // 根路径 / 由 src/pages/index.astro 直接渲染英文首页
  // （dist/index.html），使裸域访问无需重定向。sitemap 由
  // src/pages/sitemap-{index,0}.xml.ts 在 build 阶段产出，URL 与本站
  // directory + trailingSlash: "always" 策略严格一致。
  vite: {
    plugins: [tailwindcss()],
  },
});
