import type { SiteConfig } from './config';

export type ZhScript = 'hans' | 'hant';

export function localeCodes(cfg: SiteConfig): string[] {
  return Object.keys(cfg.locales);
}

export function localePath(cfg: SiteConfig, code: string): string {
  const l = cfg.locales[code];
  if (!l) throw new Error(`unknown locale ${code}`);
  return l.path;
}

/** Resolve a locale code from a code, a path segment or a case-insensitive alias. */
export function resolveLocale(cfg: SiteConfig, input: string): string | undefined {
  const needle = input.toLowerCase();
  for (const [code, l] of Object.entries(cfg.locales)) {
    if (code.toLowerCase() === needle || l.path === needle) return code;
  }
  return undefined;
}

export function isZh(code: string): boolean {
  return /^zh(-|$)/i.test(code);
}

const HANT_HINTS = /-(hant|tw|hk|mo)\b/i;

export function zhScript(code: string): ZhScript | undefined {
  if (!isZh(code)) return undefined;
  return HANT_HINTS.test(code) ? 'hant' : 'hans';
}

/** OpenCC preset that converts from script `from` to locale `to` (honouring an explicit derive preset). */
export function openccPreset(cfg: SiteConfig, from: string, to: string): string {
  const derive = cfg.locales[to]?.derive;
  if (derive && derive.from === from) return derive.opencc;
  const s = zhScript(from);
  const t = zhScript(to);
  if (s === t) return 'identity';
  if (t === 'hant') return /-hk\b/i.test(to) ? 's2hk' : /-tw\b|hant/i.test(to) ? 's2twp' : 's2t';
  return /-hk\b/i.test(from) ? 'hk2s' : /-tw\b|hant/i.test(from) ? 'tw2sp' : 't2s';
}
