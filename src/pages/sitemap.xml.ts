// 单文件站点地图（sitemap.xml）：将原 sitemap-index.xml + sitemap-0.xml
// 合并为一个 urlset，避免双层 sitemapindex 引用造成的 404 / 解析问题。
// 替代方案见 plans/14-ops-runbook.md §14.5.2。
import type { APIRoute } from "astro";
import { collectSitemapUrls, buildAlternateHreflangs } from "../lib/sitemap";
import { absoluteUrl } from "../i18n/utils";

export const GET: APIRoute = async ({ site }) => {
  const urls = await collectSitemapUrls();
  const entries: string[] = [];
  for (const u of urls) {
    const loc = absoluteUrl(u.path);
    entries.push(
      `  <url>\n    <loc>${loc}</loc>\n${buildAlternateHreflangs(u.path, site)}\n  </url>`,
    );
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
