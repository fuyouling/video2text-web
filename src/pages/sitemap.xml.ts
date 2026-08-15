import type { APIRoute } from "astro";

// robots.txt 引用 /sitemap.xml，而 @astrojs/sitemap 集成输出的是
// sitemap-index.xml + sitemap-0.xml。该端点生成 /sitemap.xml 作为站点地图索引，
// 指向集成生成的 sitemap-0.xml，从而保证 robots.txt 中的 Sitemap 指令有效。
// 域名使用构建期的 Astro.site（由 PUBLIC_SITE 注入），避免写死。
export const GET: APIRoute = ({ site }) => {
  const base = (site ?? new URL("https://video2text.dpdns.org")).href.replace(/\/$/, "");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${base}/sitemap-0.xml</loc>
  </sitemap>
</sitemapindex>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
};
