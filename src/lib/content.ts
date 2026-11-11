import { getCollection, type CollectionEntry } from 'astro:content';
import { loadSiteConfig } from './config';
import { localePath } from './locales';

export type Entry = CollectionEntry<'posts'> | CollectionEntry<'pages'>;
export type Post = CollectionEntry<'posts'>;

export const cfg = loadSiteConfig();
export const LOCALES = Object.keys(cfg.locales);

const visible = (e: Entry) => import.meta.env.DEV || !e.data.draft;
const byDate = (a: Entry, b: Entry) => b.data.date.valueOf() - a.data.date.valueOf();

export async function allEntries<C extends 'posts' | 'pages'>(collection: C): Promise<CollectionEntry<C>[]> {
  return (await getCollection(collection, visible as (e: CollectionEntry<C>) => boolean)).sort(byDate);
}

export async function postsIn(locale: string): Promise<Post[]> {
  return (await allEntries('posts')).filter((e) => e.data.uniblog.locale === locale);
}

export function slugOf(e: Entry): string {
  return e.data.slug ?? e.data.uniblog.key;
}

export function localeHome(locale: string): string {
  return `/${localePath(cfg, locale)}/`;
}

export function entryUrl(e: Entry): string {
  const base = localeHome(e.data.uniblog.locale);
  return e.data.uniblog.collection === 'posts' ? `${base}posts/${slugOf(e)}/` : `${base}${slugOf(e)}/`;
}

export interface Peer {
  locale: string;
  url: string;
  status: Entry['data']['uniblog']['status'];
}

/** All language versions of the same item, in site locale order. */
export async function peersOf(e: Entry): Promise<Peer[]> {
  const all = await allEntries(e.data.uniblog.collection);
  const peers = all.filter((x) => x.data.uniblog.key === e.data.uniblog.key);
  return LOCALES.flatMap((l) => {
    const p = peers.find((x) => x.data.uniblog.locale === l);
    return p ? [{ locale: l, url: entryUrl(p), status: p.data.uniblog.status }] : [];
  });
}

export function readingMinutes(body = ''): number {
  const cjk = (body.match(/[぀-ヿ㐀-鿿가-힯]/g) ?? []).length;
  const words = body.replace(/[぀-ヿ㐀-鿿가-힯]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(cjk / 400 + words / 220));
}

export function formatDate(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
}

export function siteTitle(locale: string): string {
  return cfg.title[locale] ?? cfg.title[cfg.defaultLocale] ?? Object.values(cfg.title)[0]!;
}

export function siteDescription(locale: string): string {
  return cfg.description[locale] ?? cfg.description[cfg.defaultLocale] ?? '';
}

/** getStaticPaths helper: one path per locale. */
export function localePaths() {
  return LOCALES.map((locale) => ({ params: { locale: localePath(cfg, locale) }, props: { locale } }));
}
