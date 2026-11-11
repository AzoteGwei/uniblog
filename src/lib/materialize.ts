/**
 * Materialise every (item, locale) pair into `.uniblog/content/<path>/<collection>/<key>/index.md(x)`.
 * Astro only ever reads the materialised tree.
 */
import { copyFileSync, existsSync, linkSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import type { SiteConfig } from './config';
import { joinFrontmatter, TEXT_FIELDS } from './frontmatter';
import { hashOf, loadGlossary, type Glossary } from './glossary';
import { isZh, localePath, openccPreset } from './locales';
import { loadLock, lockKey, type Lock } from './lock';
import { openccConverter } from './opencc';
import { discoverSources, readDoc, translatableHash, wantedLocales, type Doc, type SourceItem } from './sources';
import { convertZhMarkdown, convertZhText } from './wikiconv';

export type Status = 'source' | 'human' | 'reviewed' | 'machine' | 'stale' | 'fallback';

export interface Resolved {
  locale: string;
  status: Status;
  /** Set when produced by OpenCC from another zh variant. */
  derivedFrom?: string;
  doc: Pick<Doc, 'data' | 'body' | 'ext'>;
  provider?: string;
  model?: string;
}

export const OUT_DIR = '.uniblog/content';

export function translationFile(cfg: SiteConfig, root: string, item: Pick<SourceItem, 'collection' | 'key'>, locale: string, ext = '.md'): string {
  return resolve(root, 'i18n/translations', localePath(cfg, locale), item.collection, item.key + ext);
}

export function findTranslation(cfg: SiteConfig, root: string, item: SourceItem, locale: string): string | undefined {
  for (const ext of [item.primary.ext, '.md', '.mdx']) {
    const f = translationFile(cfg, root, item, locale, ext);
    if (existsSync(f)) return f;
  }
  return undefined;
}

interface Ctx {
  cfg: SiteConfig;
  root: string;
  lock: Lock;
  glossary: Glossary;
}

/** Directly available (non-derived) version of an item in a locale. */
export function directVersion(ctx: Ctx, item: SourceItem, locale: string): Resolved | undefined {
  if (item.lang === locale) return { locale, status: 'source', doc: item.primary };
  const human = item.humans.get(locale);
  if (human) return { locale, status: 'human', doc: overlay(item.primary, human) };
  const file = findTranslation(ctx.cfg, ctx.root, item, locale);
  if (!file) return undefined;
  const t = readDoc(file);
  const entry = ctx.lock.entries[lockKey(item.collection, item.key)]?.[locale];
  let status: Status;
  if (!entry) status = 'human';
  else if (entry.sourceHash !== translatableHash(item.primary)) status = 'stale';
  else if (t.data.reviewed === true || entry.edited || entry.outputHash !== hashOf(readFileSync(file, 'utf8'))) status = 'reviewed';
  else status = 'machine';
  return { locale, status, doc: overlay(item.primary, t), provider: entry?.provider, model: entry?.model };
}

/** Translated docs only carry text fields; everything else comes from the source. */
function overlay(source: Doc, t: Doc): Pick<Doc, 'data' | 'body' | 'ext'> {
  const data = { ...source.data };
  for (const [k, v] of Object.entries(t.data)) if (k !== 'lang') data[k] = v;
  return { data, body: t.body, ext: t.ext };
}

const RANK: Record<Status, number> = { source: 0, human: 1, reviewed: 2, machine: 3, stale: 4, fallback: 5 };

function zhConvert(ctx: Ctx, doc: Resolved['doc'], from: string, to: string): Resolved['doc'] {
  const opts = {
    target: to,
    source: from,
    convert: openccConverter(openccPreset(ctx.cfg, from, to)),
    terms: ctx.glossary.opencc,
    mdx: doc.ext === '.mdx',
  };
  const data = { ...doc.data };
  for (const f of TEXT_FIELDS) if (typeof data[f] === 'string') data[f] = convertZhText(data[f] as string, opts);
  return { data, body: convertZhMarkdown(doc.body, opts), ext: doc.ext };
}

export function resolveItem(ctx: Ctx, item: SourceItem): Resolved[] {
  const locales = wantedLocales(ctx.cfg, item);
  const direct = new Map<string, Resolved>();
  for (const l of Object.keys(ctx.cfg.locales)) {
    const v = directVersion(ctx, item, l);
    if (v) direct.set(l, v);
  }
  const out: Resolved[] = [];
  for (const locale of locales) {
    let r = direct.get(locale);
    if (isZh(locale)) {
      // Human-authored text in this variant always wins; otherwise a better-ranked
      // sibling zh variant (e.g. the zh-Hans source for zh-Hant) is converted with OpenCC.
      const ownIsAuthored = r && RANK[r.status] <= RANK.reviewed;
      if (!ownIsAuthored) {
        for (const [l, v] of direct) {
          if (l === locale || !isZh(l)) continue;
          if (!r || RANK[v.status] < RANK[r.status]) {
            r = { ...v, locale, derivedFrom: l, doc: zhConvert(ctx, v.doc, l, locale) };
          }
        }
      }
      if (r && !r.derivedFrom) r = { ...r, doc: zhConvert(ctx, r.doc, locale, locale) };
    }
    if (!r) {
      const src = item.primary;
      const doc = isZh(item.lang) ? zhConvert(ctx, src, item.lang, item.lang) : src;
      r = { locale, status: 'fallback', doc };
    }
    out.push(r);
  }
  return out;
}

function render(item: SourceItem, r: Resolved): string {
  const data = {
    ...r.doc.data,
    lang: undefined,
    translate: undefined,
    glossary: undefined,
    uniblog: {
      key: item.key,
      collection: item.collection,
      locale: r.locale,
      sourceLocale: item.lang,
      status: r.status,
      derivedFrom: r.derivedFrom,
      provider: r.provider,
      model: r.model,
    },
  };
  return joinFrontmatter(data, r.doc.body);
}

function writeIfChanged(file: string, content: string): boolean {
  if (existsSync(file) && readFileSync(file, 'utf8') === content) return false;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return true;
}

function linkAsset(src: string, dest: string): void {
  if (existsSync(dest)) {
    const a = statSync(src);
    const b = statSync(dest);
    if (a.ino === b.ino || (a.size === b.size && a.mtimeMs <= b.mtimeMs)) return;
    rmSync(dest, { recursive: true });
  }
  mkdirSync(dirname(dest), { recursive: true });
  if (statSync(src).isDirectory()) {
    for (const f of readdirSync(src)) linkAsset(join(src, f), join(dest, f));
    return;
  }
  try {
    linkSync(src, dest);
  } catch {
    copyFileSync(src, dest);
  }
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

export interface MaterializeReport {
  items: { item: SourceItem; resolved: Resolved[] }[];
  written: string[];
  removed: string[];
}

export function materialize(cfg: SiteConfig, root = process.cwd()): MaterializeReport {
  const ctx: Ctx = { cfg, root, lock: loadLock(root), glossary: loadGlossary(root) };
  const outRoot = resolve(root, OUT_DIR);
  const keep = new Set<string>();
  const written: string[] = [];
  const items = discoverSources(cfg, root).map((item) => ({ item, resolved: resolveItem(ctx, item) }));
  for (const { item, resolved } of items) {
    for (const r of resolved) {
      const dir = join(outRoot, localePath(cfg, r.locale), item.collection, item.key);
      const file = join(dir, 'index' + r.doc.ext);
      keep.add(file);
      if (writeIfChanged(file, render(item, r))) written.push(relative(root, file));
      for (const a of item.assets) {
        const dest = join(dir, basename(a));
        keep.add(dest);
        linkAsset(a, dest);
      }
    }
  }
  const removed: string[] = [];
  for (const f of walk(outRoot)) {
    if (keep.has(f) || [...keep].some((k) => f.startsWith(k + '/'))) continue;
    rmSync(f);
    removed.push(relative(root, f));
  }
  return { items, written, removed };
}
