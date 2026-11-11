import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const uniblog = z.object({
  key: z.string(),
  collection: z.enum(['posts', 'pages']),
  locale: z.string(),
  sourceLocale: z.string(),
  status: z.enum(['source', 'human', 'reviewed', 'machine', 'stale', 'fallback']),
  derivedFrom: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

const schema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  lastmod: z.coerce.date().optional(),
  draft: z.boolean().default(false),
  slug: z.string().optional(),
  tags: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  summary: z.string().optional(),
  description: z.string().optional(),
  cover: z.string().optional(),
  reviewed: z.boolean().optional(),
  uniblog,
});

// Entries are produced by the uniblog materializer (see src/lib/materialize.ts).
const make = (collection: 'posts' | 'pages') =>
  defineCollection({
    loader: glob({
      base: './.uniblog/content',
      pattern: `*/${collection}/*/index.{md,mdx}`,
      generateId: ({ entry }) => entry.replace(/\/index\.mdx?$/, ''),
    }),
    schema,
  });

export const collections = { posts: make('posts'), pages: make('pages') };
