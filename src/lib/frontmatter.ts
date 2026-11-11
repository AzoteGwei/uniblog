import { parse, stringify } from 'yaml';
import { z } from 'zod';

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const m = raw.match(FM_RE);
  if (!m) return { data: {}, body: raw };
  const data = (parse(m[1]!) ?? {}) as Record<string, unknown>;
  return { data, body: raw.slice(m[0].length) };
}

export function joinFrontmatter(data: Record<string, unknown>, body: string): string {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  return `---\n${stringify(clean, { lineWidth: 0 }).trimEnd()}\n---\n\n${body.replace(/^\n+/, '')}`;
}

/** Fields that are translated / zh-converted. */
export const TEXT_FIELDS = ['title', 'description', 'summary'] as const;

export const sourceFrontmatter = z
  .looseObject({
    title: z.string(),
    date: z.coerce.date(),
    lastmod: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    lang: z.string().optional(),
    slug: z.string().optional(),
    tags: z.array(z.string()).default([]),
    categories: z.array(z.string()).default([]),
    summary: z.string().optional(),
    description: z.string().optional(),
    cover: z.string().optional(),
    translate: z.union([z.boolean(), z.array(z.string())]).default(true),
    glossary: z.array(z.record(z.string(), z.union([z.string(), z.boolean()]))).optional(),
    reviewed: z.boolean().optional(),
  });

export type SourceFrontmatter = z.infer<typeof sourceFrontmatter>;
