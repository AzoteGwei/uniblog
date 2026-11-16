import { describe, expect, it } from 'vitest';
import { parseSiteConfig } from '../src/lib/config';

describe('site.yaml', () => {
  it('rejects unknown defaultLocale', () => {
    expect(() =>
      parseSiteConfig(`title: {a: b}\nauthor: x\nurl: https://x.y\ndefaultLocale: fr\nlocales: {ja: {path: ja, label: j}}\ntranslate: {zhPivot: ja, default: {provider: mock}}`),
    ).toThrow(/defaultLocale/);
  });
});
