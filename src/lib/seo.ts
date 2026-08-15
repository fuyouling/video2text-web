import { absoluteUrl } from "../i18n/utils";

// 结构化数据（JSON-LD）与 hreflang 助手，供 SEOHead 与各页面渲染。

export function buildSoftwareApplicationJsonLd(opts: {
  name: string;
  os: string;
  url: string;
  priceCents: number;
  currency: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: opts.name,
    operatingSystem: opts.os,
    applicationCategory: "MultimediaApplication",
    offers: {
      "@type": "Offer",
      price: (opts.priceCents / 100).toFixed(2),
      priceCurrency: opts.currency,
    },
    url: absoluteUrl(opts.url),
  };
}

export function buildOrganizationJsonLd(opts: {
  name: string;
  url: string;
  logo: string;
  sameAs?: string[];
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: opts.name,
    url: absoluteUrl(opts.url),
    logo: absoluteUrl(opts.logo),
    ...(opts.sameAs && opts.sameAs.length ? { sameAs: opts.sameAs } : {}),
  };
}

export function buildWebSiteJsonLd(opts: {
  name: string;
  url: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: opts.name,
    url: absoluteUrl(opts.url),
  };
}

export function buildArticleJsonLd(opts: {
  title: string;
  url: string;
  date: string;
  author: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    datePublished: opts.date,
    author: { "@type": "Organization", name: opts.author },
    mainEntityOfPage: absoluteUrl(opts.url),
  };
}

export function buildHreflang(path: string): { rel: string; href: string; hreflang: string }[] {
  const base = absoluteUrl(path);
  const localized = path.replace(/^\/(en|zh)/, "");
  return [
    { rel: "alternate", hreflang: "en", href: absoluteUrl("/en" + localized) },
    { rel: "alternate", hreflang: "zh", href: absoluteUrl("/zh" + localized) },
    { rel: "alternate", hreflang: "x-default", href: absoluteUrl("/en" + localized) },
  ].map((h) => ({ ...h, href: h.href === base ? base : h.href }));
}
