import { defineCollection, z } from "astro:content";

const docs = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    lang: z.enum(["en", "zh"]),
    order: z.number().default(99),
    category: z.string().optional(),
    description: z.string().optional(),
  }),
});

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    lang: z.enum(["en", "zh"]),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    author: z.string().default("video2text"),
    draft: z.boolean().default(false),
  }),
});

export const collections = { docs, blog };
