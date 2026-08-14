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
  // / 由下方 redirects 生成静态 /index.html 跳转；正式部署还需在
  // Cloudflare Pages 配置 / → /en 的 301（服务端），保证 SEO 正确。
  redirects: {
    "/": "/en",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
