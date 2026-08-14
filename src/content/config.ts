import { defineCollection, z } from "astro:content";
import type { Lang } from "../i18n/ui";

const LANG_ENUM = z.enum([
  "en",
  "zh",
  "zh-TW",
  "de",
  "es",
  "fr",
  "ja",
  "ko",
  "ru",
] as [Lang, ...Lang[]]);

const docs = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    lang: LANG_ENUM,
    order: z.number().default(99),
    pubDate: z.coerce.date().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
  }),
});

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    lang: LANG_ENUM,
    order: z.number().default(99),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    author: z.string().default("video2text"),
    draft: z.boolean().default(false),
  }),
});

export const collections = { docs, blog };
