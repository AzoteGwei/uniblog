import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';

const termSchema = z.record(z.string(), z.union([z.string(), z.boolean()]));

export const glossarySchema = z.object({
  terms: z.array(termSchema).default([]),
  opencc: z.array(z.record(z.string(), z.string())).default([]),
});

export type Glossary = z.infer<typeof glossarySchema>;
export type GlossaryTerm = z.infer<typeof termSchema>;

export function loadGlossary(root = process.cwd()): Glossary {
  const file = resolve(root, 'i18n/glossary.yaml');
  if (!existsSync(file)) return { terms: [], opencc: [] };
  return glossarySchema.parse(parse(readFileSync(file, 'utf8')) ?? {});
}

export function hashOf(value: unknown): string {
  return 'sha256:' + createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex').slice(0, 16);
}

/** Look up a term value for a locale, case-insensitively on the key. */
export function termFor(t: GlossaryTerm, locale: string): string | undefined {
  const want = locale.toLowerCase();
  for (const [k, v] of Object.entries(t)) if (k.toLowerCase() === want && typeof v === 'string') return v;
  return undefined;
}

/** Terms whose source-language form occurs in `text`. */
export function relevantTerms(g: Glossary, sourceLocale: string, text: string): GlossaryTerm[] {
  return g.terms.filter((t) => {
    const s = termFor(t, sourceLocale);
    return s !== undefined && text.includes(s);
  });
}
