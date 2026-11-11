import type { GlossaryTerm } from '../../src/lib/glossary';

export interface TranslateJob {
  /** e.g. `posts/hello` — for logs and prompt context. */
  id: string;
  sourceLocale: string;
  targetLocale: string;
  /** Markdown body with untranslatable spans replaced by ⟦n⟧ placeholders. */
  body: string;
  /** Front-matter text fields (title, summary, …). */
  fields: Record<string, string>;
  glossary: GlossaryTerm[];
  /** Per-item guidance from front matter, if any. */
  notes?: string;
}

export interface TranslateResult {
  body: string;
  fields: Record<string, string>;
}

export interface TranslationProvider {
  id: string;
  model?: string;
  translate(job: TranslateJob): Promise<TranslateResult>;
}

export interface ProviderRef {
  provider: string;
  model?: string;
  options?: Record<string, unknown>;
}

export class ProviderUnavailable extends Error {}
