import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSiteConfig } from '../src/lib/config';

describe('site.yaml', () => {
  it('parses the repository config', () => {
    const cfg = parseSiteConfig(readFileSync('site.yaml', 'utf8'));
    expect(cfg.locales['zh-Hant']?.derive?.opencc).toBe('s2twp');
    expect(cfg.locales['en-US']?.path).toBe('en-us');
  });
  it('rejects unknown defaultLocale', () => {
    expect(() =>
      parseSiteConfig(`title: {a: b}\nauthor: x\nurl: https://x.y\ndefaultLocale: fr\nlocales: {ja: {path: ja, label: j}}\ntranslate: {zhPivot: ja, default: {provider: mock}}`),
    ).toThrow(/defaultLocale/);
  });
});
