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
  // 采用 file 输出格式：每个路由生成为 .html 文件（如 dist/en.html），
  // 而不是目录 + index.html。这样裸路径 /en、/en/pricing 可直接命中文件，
  // 避免 Cloudflare Pages 对目录自动 301 追加斜杠（/en -> /en/）造成的逐个
  // 页面重定向。配合 scripts/no-redirect.mjs，/en/ 与 /en/index.html 两种
  // 形式也保留可用、且无需重定向。根目录 / 由该脚本直接写入英文首页。
  build: { format: "file" },
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
