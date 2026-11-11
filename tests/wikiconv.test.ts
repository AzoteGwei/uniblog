import { describe, expect, it } from 'vitest';
import { openccConverter } from '../src/lib/opencc';
import { convertZhMarkdown, convertZhText, resolveRule, variantChain } from '../src/lib/wikiconv';

const s2twp = openccConverter('s2twp');
const id = openccConverter('identity');
const toHant = { target: 'zh-Hant', source: 'zh-Hans', convert: s2twp };
const toHans = { target: 'zh-Hans', source: 'zh-Hans', convert: id };

describe('variantChain', () => {
  it('prefers regional keys', () => {
    expect(variantChain('zh-TW').slice(0, 2)).toEqual(['zh-tw', 'zh-hant']);
    expect(variantChain('zh-Hans')[0]).toBe('zh-hans');
  });
});

describe('resolveRule', () => {
  it('picks target variant', () => {
    expect(resolveRule('zh-hans:内存;zh-hant:記憶體;', 'zh-Hant', s2twp)).toBe('記憶體');
    expect(resolveRule('zh-cn:内存; zh-tw:記憶體', 'zh-Hans', id)).toBe('内存');
  });
  it('returns literal rules verbatim', () => {
    expect(resolveRule('软件', 'zh-Hant', s2twp)).toBe('软件');
  });
  it('falls back by converting another variant', () => {
    expect(resolveRule('zh-hans:软件', 'zh-Hant', s2twp)).toBe('軟體');
  });
});

describe('convertZhMarkdown', () => {
  it('converts prose and keeps code', () => {
    const src = '# 软件\n\n这是`内存`和代码：\n\n```js\n// 软件\n```\n';
    expect(convertZhMarkdown(src, toHant)).toBe('# 軟體\n\n這是`内存`和程式碼：\n\n```js\n// 软件\n```\n');
  });
  it('applies manual rules and literal rules', () => {
    const src = '用-{zh-hans:内存;zh-hant:RAM;}-和-{软件}-';
    expect(convertZhMarkdown(src, toHant)).toBe('用RAM和软件');
    expect(convertZhMarkdown(src, toHans)).toBe('用内存和软件');
  });
  it('ignores rules inside inline code', () => {
    expect(convertZhMarkdown('`-{a}-` 软件', toHant)).toBe('`-{a}-` 軟體');
  });
  it('protects link and image destinations', () => {
    const src = '[软件](/软件/) ![软件](./软件.png)';
    expect(convertZhMarkdown(src, toHant)).toBe('[軟體](/软件/) ![軟體](./软件.png)');
  });
  it('converts text inside html but not tags', () => {
    expect(convertZhMarkdown('<span title="软件">软件</span>\n', toHant)).toBe('<span title="软件">軟體</span>\n');
  });
  it('keeps MDX expressions and attributes', () => {
    const src = 'import X from "./软件"\n\n<X label="软件">软件</X>\n';
    expect(convertZhMarkdown(src, { ...toHant, mdx: true })).toBe('import X from "./软件"\n\n<X label="软件">軟體</X>\n');
  });
  it('honours glossary terms', () => {
    const terms = [{ 'zh-hans': '软件', 'zh-hant': '軟件' }];
    expect(convertZhMarkdown('软件开发', { ...toHant, terms })).toBe('軟件開發');
  });
});

describe('convertZhText', () => {
  it('converts titles with rules', () => {
    expect(convertZhText('-{zh-hans:内存;zh-hant:記憶體}-软件', toHant)).toBe('記憶體軟體');
  });
});
