import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { loadSiteConfig } from './config';
import { isZh, openccPreset } from './locales';
import { openccConverter } from './opencc';

type Dict = Record<string, string>;
const cache = new Map<string, Dict>();

function readYaml(file: string): Record<string, unknown> | undefined {
  return existsSync(file) ? ((parse(readFileSync(file, 'utf8')) ?? {}) as Record<string, unknown>) : undefined;
}

/** Find a sibling zh locale with its own data to derive from (prefers explicit `derive.from`). */
function zhDonor(locale: string, has: (l: string) => boolean): string | undefined {
  const cfg = loadSiteConfig();
  const from = cfg.locales[locale]?.derive?.from;
  if (from && has(from)) return from;
  return Object.keys(cfg.locales).find((l) => l !== locale && isZh(l) && has(l));
}

function uiDict(locale: string): Dict {
  let d = cache.get(locale);
  if (d) return d;
  const file = (l: string) => resolve('i18n/ui', `${l}.yaml`);
  const own = readYaml(file(locale)) as Dict | undefined;
  // zh variants get an OpenCC base from a sibling's *own file* (not its merged dict, so
  // zh-Hans <-> zh-Hant never recurse). Either direction works: s2twp or tw2sp.
  const derived: Dict = {};
  const donor = isZh(locale) ? zhDonor(locale, (l) => existsSync(file(l))) : undefined;
  if (donor) {
    const conv = openccConverter(openccPreset(loadSiteConfig(), donor, locale));
    for (const [k, v] of Object.entries((readYaml(file(donor)) ?? {}) as Dict)) derived[k] = conv(v);
  }
  const fallback = (readYaml(file('en-US')) ?? {}) as Dict;
  d = { ...fallback, ...derived, ...(own ?? {}) };
  cache.set(locale, d);
  return d;
}

export function t(locale: string, key: string, vars: Record<string, string | number> = {}): string {
  const s = uiDict(locale)[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

type Tax = Record<string, Record<string, Record<string, string>>>;
let tax: Tax | undefined;

export function termLabel(locale: string, kind: 'tags' | 'categories', key: string): string {
  tax ??= (readYaml(resolve('i18n/taxonomy.yaml')) ?? {}) as Tax;
  const names = tax[kind]?.[key];
  if (!names) return key;
  if (names[locale]) return names[locale]!;
  if (isZh(locale)) {
    const donor = zhDonor(locale, (l) => !!names[l]);
    if (donor) return openccConverter(openccPreset(loadSiteConfig(), donor, locale))(names[donor]!);
  }
  return names['en-US'] ?? key;
}
