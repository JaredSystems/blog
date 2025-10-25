import { defineCollection, z } from "astro:content";

const writings = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    article_date: z.date(),
    tags: z.array(z.string()),
  }),
});

export const collections = { writings };
