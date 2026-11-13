import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { SiteConfig } from '../../src/lib/config';
import { joinFrontmatter, TEXT_FIELDS } from '../../src/lib/frontmatter';
import { hashOf, loadGlossary, relevantTerms, type GlossaryTerm } from '../../src/lib/glossary';
import { isZh } from '../../src/lib/locales';
import { loadLock, lockKey, updateLock } from '../../src/lib/lock';
import { findTranslation, translationFile } from '../../src/lib/materialize';
import { openccConverter } from '../../src/lib/opencc';
import { COLLECTIONS, discoverSources, translatableHash, wantedLocales, type SourceItem } from '../../src/lib/sources';
import { convertZhMarkdown, convertZhText } from '../../src/lib/wikiconv';
import { PROMPT_VERSION } from './llm';
import { headingCount, PlaceholderError, protect, restore } from './protect';
import { createProvider } from './providers';
import { ProviderUnavailable, type ProviderRef, type TranslateJob, type TranslationProvider } from './types';

export interface PlannedJob {
  item: SourceItem;
  locale: string;
  reason: 'missing' | 'stale' | 'forced';
}

export interface SkippedJob {
  item: SourceItem;
  locale: string;
  reason: 'edited-stale' | 'hand-placed';
}

export interface PlanOptions {
  keys?: string[];
  locales?: string[];
  force?: boolean;
}

export interface Orphans {
  /** Translation files (repo-relative) whose source post/page no longer exists. */
  files: string[];
  /** Lock ids (`collection/key`) whose source no longer exists. */
  lockIds: string[];
}

/** Leftovers of deleted or renamed sources: translation files and lock entries. */
export function findOrphans(cfg: SiteConfig, root: string): Orphans {
  const live = new Set(discoverSources(cfg, root).map((i) => lockKey(i.collection, i.key)));
  const files: string[] = [];
  const base = resolve(root, 'i18n/translations');
  if (existsSync(base))
    for (const loc of readdirSync(base))
      for (const col of COLLECTIONS) {
        const dir = join(base, loc, col);
        if (!existsSync(dir)) continue;
        for (const f of readdirSync(dir))
          if (/\.mdx?$/.test(f) && !live.has(lockKey(col, f.replace(/\.mdx?$/, '')))) files.push(relative(root, join(dir, f)));
      }
  const lockIds = Object.keys(loadLock(root).entries).filter((id) => !live.has(id));
  return { files: files.sort(), lockIds };
}

/** Delete orphaned translation files and lock entries (they stay recoverable from Git). */
export function pruneOrphans(cfg: SiteConfig, root: string): Orphans {
  const o = findOrphans(cfg, root);
  for (const f of o.files) rmSync(resolve(root, f));
  if (o.lockIds.length) updateLock(root, (lock) => o.lockIds.forEach((id) => delete lock.entries[id]));
  return o;
}

/** Locales that need an engine translation (zh siblings are derived with OpenCC instead). */
export function translationTargets(cfg: SiteConfig, item: SourceItem): string[] {
  return wantedLocales(cfg, item).filter((l) => {
    if (l === item.lang || item.humans.has(l)) return false;
    if (isZh(l)) return !isZh(item.lang) && l === cfg.translate.zhPivot && !hasHumanZh(item);
    return true;
  });
}

function hasHumanZh(item: SourceItem): boolean {
  return [...item.humans.keys()].some(isZh);
}

export function planJobs(cfg: SiteConfig, root: string, opts: PlanOptions = {}): { jobs: PlannedJob[]; skipped: SkippedJob[] } {
  const lock = loadLock(root);
  const jobs: PlannedJob[] = [];
  const skipped: SkippedJob[] = [];
  for (const item of discoverSources(cfg, root)) {
    const id = lockKey(item.collection, item.key);
    if (opts.keys?.length && !opts.keys.some((k) => k === item.key || k === id)) continue;
    const current = translatableHash(item.primary);
    for (const locale of translationTargets(cfg, item)) {
      if (opts.locales?.length && !opts.locales.includes(locale)) continue;
      const file = findTranslation(cfg, root, item, locale);
      const entry = lock.entries[id]?.[locale];
      if (!file) {
        jobs.push({ item, locale, reason: 'missing' });
        continue;
      }
      if (opts.force) {
        jobs.push({ item, locale, reason: 'forced' });
        continue;
      }
      if (!entry) {
        skipped.push({ item, locale, reason: 'hand-placed' });
        continue;
      }
      if (entry.sourceHash === current) continue;
      const raw = readFileSync(file, 'utf8');
      const edited = entry.edited || entry.outputHash !== hashOf(raw) || /^reviewed:\s*true\s*$/m.test(raw);
      if (edited) skipped.push({ item, locale, reason: 'edited-stale' });
      else jobs.push({ item, locale, reason: 'stale' });
    }
  }
  return { jobs, skipped };
}

export function providerRefFor(cfg: SiteConfig, locale: string, override?: string): ProviderRef {
  if (override) return { provider: override };
  return cfg.translate.overrides[locale] ?? cfg.translate.default;
}

function buildJob(root: string, item: SourceItem, locale: string): { job: TranslateJob; slots: string[] } {
  const g = loadGlossary(root);
  const zh = isZh(item.lang);
  const keep = { target: item.lang, source: item.lang, convert: openccConverter('identity') };
  const mdx = item.primary.ext === '.mdx';
  const body = zh ? convertZhMarkdown(item.primary.body, { ...keep, mdx }) : item.primary.body;
  const fields: Record<string, string> = {};
  for (const f of TEXT_FIELDS) {
    const v = item.primary.data[f];
    if (typeof v === 'string' && v.trim()) fields[f] = zh ? convertZhText(v, keep) : v;
  }
  const p = protect(body, { mdx });
  const local = (item.primary.data.glossary as GlossaryTerm[] | undefined) ?? [];
  const terms = [...local, ...relevantTerms(g, item.lang, p.text + Object.values(fields).join('\n'))];
  const notes = typeof item.primary.data.translatorNotes === 'string' ? item.primary.data.translatorNotes : undefined;
  return {
    job: { id: lockKey(item.collection, item.key), sourceLocale: item.lang, targetLocale: locale, body: p.text, fields, glossary: terms, notes },
    slots: p.slots,
  };
}

export interface RunResult {
  done: { job: PlannedJob; file: string; provider: string }[];
  failed: { job: PlannedJob; error: string }[];
}

export interface RunOptions {
  provider?: string;
  concurrency?: number;
  retries?: number;
  dryRun?: boolean;
  log?: (msg: string) => void;
}

export async function runJobs(cfg: SiteConfig, root: string, jobs: PlannedJob[], opts: RunOptions = {}): Promise<RunResult> {
  const log = opts.log ?? (() => {});
  const result: RunResult = { done: [], failed: [] };
  const providers = new Map<string, TranslationProvider | Error>();
  const providerFor = (locale: string) => {
    const ref = providerRefFor(cfg, locale, opts.provider);
    const k = JSON.stringify(ref);
    if (!providers.has(k)) {
      try {
        providers.set(k, createProvider(ref));
      } catch (e) {
        providers.set(k, e as Error);
      }
    }
    const p = providers.get(k)!;
    if (p instanceof Error) throw p;
    return p;
  };
  const retries = opts.retries ?? 2;
  const queue = [...jobs];

  const worker = async () => {
    for (let pj = queue.shift(); pj; pj = queue.shift()) {
      const { item, locale } = pj;
      const label = `${item.collection}/${item.key} → ${locale}`;
      try {
        const { job, slots } = buildJob(root, item, locale);
        if (opts.dryRun) {
          const ref = providerRefFor(cfg, locale, opts.provider);
          log(`[dry-run] ${label} via ${ref.provider}${ref.model ? `/${ref.model}` : ''} (${pj.reason}, ${job.body.length} chars, ${job.glossary.length} glossary terms)`);
          continue;
        }
        const provider = providerFor(locale);
        let body: string | undefined;
        let fields: Record<string, string> = {};
        let lastErr: unknown;
        for (let attempt = 0; attempt <= retries && body === undefined; attempt++) {
          try {
            const r = await provider.translate(job);
            if (headingCount(r.body) !== headingCount(job.body))
              throw new PlaceholderError(`heading count changed (${headingCount(job.body)} → ${headingCount(r.body)})`);
            body = restore(r.body, slots);
            fields = r.fields;
          } catch (e) {
            lastErr = e;
            if (!(e instanceof PlaceholderError) && !/missing/.test(String(e))) throw e;
            log(`  retry ${label}: ${(e as Error).message}`);
          }
        }
        if (body === undefined) throw lastErr;
        const file = translationFile(cfg, root, item, locale, item.primary.ext);
        const content = joinFrontmatter(fields, body.endsWith('\n') ? body : body + '\n');
        // Lock entry first: if we die before the file is written, the next run sees
        // "missing" and retranslates, instead of a lockless file that is skipped as hand-placed.
        const id = lockKey(item.collection, item.key);
        updateLock(root, (lock) => {
          lock.entries[id] ??= {};
          lock.entries[id][locale] = {
            sourceHash: translatableHash(item.primary),
            glossaryHash: hashOf(job.glossary),
            promptVersion: PROMPT_VERSION,
            provider: provider.id,
            model: provider.model,
            translatedAt: new Date().toISOString(),
            outputHash: hashOf(content),
          };
        });
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content);
        result.done.push({ job: pj, file: relative(root, file), provider: provider.id });
        log(`✓ ${label} (${provider.id}${provider.model ? `/${provider.model}` : ''})`);
      } catch (e) {
        const msg = e instanceof ProviderUnavailable ? `provider unavailable: ${e.message}` : e instanceof Error ? e.message : String(e);
        result.failed.push({ job: pj, error: msg });
        log(`✗ ${label}: ${msg}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 2) }, worker));
  return result;
}
