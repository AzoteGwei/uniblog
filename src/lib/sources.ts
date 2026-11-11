import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { SiteConfig } from './config';
import { splitFrontmatter, TEXT_FIELDS } from './frontmatter';
import { hashOf } from './glossary';
import { isZh, resolveLocale } from './locales';

export const COLLECTIONS = ['posts', 'pages'] as const;
export type Collection = (typeof COLLECTIONS)[number];

export interface Doc {
  file: string;
  ext: '.md' | '.mdx';
  data: Record<string, unknown>;
  body: string;
}

export interface SourceItem {
  collection: Collection;
  /** Stable key (bundle dir or file basename); shared by all languages. */
  key: string;
  /** Bundle directory, if this is a page bundle. */
  dir?: string;
  lang: string;
  primary: Doc;
  /** Human-written versions keyed by locale code. */
  humans: Map<string, Doc>;
  /** Absolute paths of bundle assets (non-index files). */
  assets: string[];
}

const DOC_EXT = new Set(['.md', '.mdx']);

export function readDoc(file: string): Doc {
  const { data, body } = splitFrontmatter(readFileSync(file, 'utf8'));
  return { file, ext: extname(file) as Doc['ext'], data, body };
}

/** Hash of the translatable part of a document (text front matter + body). */
export function translatableHash(doc: Pick<Doc, 'data' | 'body'>): string {
  const text: Record<string, unknown> = {};
  for (const f of TEXT_FIELDS) if (doc.data[f] !== undefined) text[f] = doc.data[f];
  return hashOf({ text, body: doc.body });
}

/** Split `name.en-us.md` into base and locale (if the suffix names a locale). */
function parseName(cfg: SiteConfig, name: string): { base: string; locale?: string; ext: string } | undefined {
  const ext = extname(name);
  if (!DOC_EXT.has(ext)) return undefined;
  const stem = name.slice(0, -ext.length);
  const dot = stem.lastIndexOf('.');
  if (dot > 0) {
    const loc = resolveLocale(cfg, stem.slice(dot + 1));
    if (loc) return { base: stem.slice(0, dot), locale: loc, ext };
  }
  return { base: stem, ext };
}

export function discoverSources(cfg: SiteConfig, root = process.cwd()): SourceItem[] {
  const items: SourceItem[] = [];
  for (const collection of COLLECTIONS) {
    const base = resolve(root, 'content', collection);
    if (!existsSync(base)) continue;
    const singles = new Map<string, { primary?: string; humans: Map<string, string> }>();
    for (const name of readdirSync(base).sort()) {
      if (name.startsWith('.') || name.startsWith('_')) continue;
      const full = join(base, name);
      if (statSync(full).isDirectory()) {
        const files = readdirSync(full).sort();
        let primary: string | undefined;
        const humans = new Map<string, Doc>();
        const assets: string[] = [];
        for (const f of files) {
          const p = parseName(cfg, f);
          if (p?.base === 'index') {
            if (p.locale) humans.set(p.locale, readDoc(join(full, f)));
            else primary = join(full, f);
          } else if (!f.startsWith('.')) assets.push(join(full, f));
        }
        if (!primary) continue;
        const doc = readDoc(primary);
        items.push({ collection, key: name, dir: full, lang: langOf(cfg, doc), primary: doc, humans, assets });
      } else {
        const p = parseName(cfg, name);
        if (!p) continue;
        const e = singles.get(p.base) ?? { humans: new Map() };
        if (p.locale) e.humans.set(p.locale, full);
        else e.primary = full;
        singles.set(p.base, e);
      }
    }
    for (const [key, e] of singles) {
      if (!e.primary) continue;
      const doc = readDoc(e.primary);
      const humans = new Map([...e.humans].map(([l, f]) => [l, readDoc(f)]));
      items.push({ collection, key, lang: langOf(cfg, doc), primary: doc, humans, assets: [] });
    }
  }
  return items;
}

function langOf(cfg: SiteConfig, doc: Doc): string {
  const raw = doc.data.lang;
  if (typeof raw !== 'string') return cfg.defaultLocale;
  const code = resolveLocale(cfg, raw);
  if (!code) throw new Error(`${doc.file}: unknown lang "${raw}"`);
  return code;
}

/** Locales this item should be published in (honours `translate:` front matter). */
export function wantedLocales(cfg: SiteConfig, item: SourceItem): string[] {
  const all = Object.keys(cfg.locales);
  const t = item.primary.data.translate;
  if (t === true || t === undefined) return all;
  // OpenCC variants are not translations: zh sources always get their zh siblings.
  const listed = Array.isArray(t) ? t.map((x) => resolveLocale(cfg, String(x))).filter((x): x is string => !!x) : [];
  const zhSource = isZh(item.lang);
  return all.filter((l) => l === item.lang || item.humans.has(l) || listed.includes(l) || (zhSource && isZh(l)));
}
