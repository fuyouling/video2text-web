import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// 默认开发/预览域名为 video2text.dpdns.org（Cloudflare 托管，免备案）。
// 生产独立域名通过 PUBLIC_SITE 构建期注入；不要在此写死最终域名。
export default defineConfig({
  site: process.env.PUBLIC_SITE || 'https://video2text.dpdns.org',
  output: 'static',
  integrations: [
    react(),
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en', zh: 'zh' },
      },
    }),
  ],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: false },
  },
  // / 由下方 redirects 生成静态 /index.html 跳转；正式部署还需在
  // Cloudflare Pages 配置 / → /en 的 301（服务端），保证 SEO 正确。
  redirects: {
    '/': '/en',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
