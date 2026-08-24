import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// 默认开发/预览域名为 video2text.dpdns.org（Cloudflare 托管，免备案）。
// 生产独立域名通过 PUBLIC_SITE 构建期注入；不要在此写死最终域名。
export default defineConfig({
  site: process.env.PUBLIC_SITE || "https://video2text.dpdns.org",
  output: "static",
  // 采用 file 输出格式：每个路由生成为直接的 .html 文件
  // （如 dist/en/index.html、dist/en/docs/getting-started.html）。URL 直接指向
  // 文件、不以 / 结尾。首页/文档首页/博客首页映射为 index.html，其余页面为
  // <name>.html。配合 trailingSlash: "never" 避免任何追加斜杠的重定向。
  // 根目录 / 由 src/pages/index.astro 直接渲染英文首页（index.html）。
  build: { format: "file" },
  // trailingSlash: "never" 配合 file 格式：所有链接均显式带 .html 扩展名，
  // 避免任何追加/剥离斜杠的重定向。注意：Astro dev 服务器对路径段名为 index
  // 的路由（/en/index.html）会按静态文件处理而 404，本地完整验证请用
  // `npm run build && npm run preview`（直接静态托管 dist，所有 .html 均可命中）；
  // 或 dev 下以 /en/index（无扩展名）访问首页。生产/预览不受影响。
  trailingSlash: "never",
  devToolbar: { enabled: false },
  integrations: [
    react(),
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: "en",
        locales: {
          en: "en",
          zh: "zh",
          "zh-TW": "zh-TW",
          de: "de",
          es: "es",
          fr: "fr",
          ja: "ja",
          ko: "ko",
          ru: "ru",
        },
      },
    }),
  ],
  // 注意：本站采用基于 [lang] 路径段 + 文件名语言前缀（如 zh-TW-*.mdx）
  // 的「手动」国际化方案，content 集合的 slug 由 baseSlug 处理。
  // 因此不要在此启用 Astro 内置 i18n，否则它会把以语言代码开头的
  // content slug（尤其是带地区的 zh-TW-*）自动改写并生成错误的 tw-* 副本路由。
  // 根路径 / 不再做重定向：build 后由 scripts/no-redirect.mjs 直接写入英文首页
  // index.html，使裸域访问也无需 301。故此处不配置 redirects。
  vite: {
    plugins: [tailwindcss()],
  },
});
