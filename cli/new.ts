import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { SiteConfig } from '../src/lib/config';
import { joinFrontmatter } from '../src/lib/frontmatter';
import { resolveLocale } from '../src/lib/locales';

export interface NewOptions {
  slug: string;
  title?: string;
  lang?: string;
  page?: boolean;
  mdx?: boolean;
  single?: boolean;
}

export function createPost(cfg: SiteConfig, opts: NewOptions, root = process.cwd()): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(opts.slug)) throw new Error(`slug must be kebab-case ascii: ${opts.slug}`);
  const lang = opts.lang ? resolveLocale(cfg, opts.lang) : cfg.defaultLocale;
  if (!lang) throw new Error(`unknown lang ${opts.lang}`);
  const collection = opts.page ? 'pages' : 'posts';
  const ext = opts.mdx ? '.mdx' : '.md';
  const base = resolve(root, 'content', collection);
  const file = opts.single ? join(base, opts.slug + ext) : join(base, opts.slug, 'index' + ext);
  if (existsSync(file) || existsSync(join(base, opts.slug))) throw new Error(`already exists: ${file}`);
  mkdirSync(opts.single ? base : join(base, opts.slug), { recursive: true });
  const data = {
    title: opts.title ?? opts.slug.replace(/-/g, ' '),
    date: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    draft: true,
    lang,
    tags: [],
    categories: [],
    summary: '',
  };
  writeFileSync(file, joinFrontmatter(data, '\n'));
  return file;
}
