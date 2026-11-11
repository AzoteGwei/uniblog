import { describe, expect, it } from 'vitest';
import { engineLang, fromTagged, segmentTranslate, toTagged } from '../cli/translate/segment';

describe('segment tagging', () => {
  it('round-trips inline markdown', () => {
    const s = '看 **粗体** 和 *斜体* 与 [链接⟦3⟧ 以及 ⟦4⟧ & <';
    expect(toTagged(s, [])).toBe('看 <b>粗体</b> 和 <i>斜体</i> 与 <a i="3">链接</a> 以及 <x i="4"/> &amp; &lt;');
    expect(fromTagged(toTagged(s, []))).toBe(s);
  });
  it('wraps do-not-translate terms', () => {
    expect(toTagged('uniblog 很好', ['uniblog'])).toBe('<k>uniblog</k> 很好');
    expect(fromTagged('<k>uniblog</k> is good')).toBe('uniblog is good');
  });
  it('keeps block prefixes and placeholder-only lines', async () => {
    const job = { id: 'x', sourceLocale: 'zh-Hans', targetLocale: 'en-US', body: '## 标题\n\n- 项目\n⟦0⟧\n', fields: { title: 'T' }, glossary: [] };
    const r = await segmentTranslate(job, async (t) => t.map((x) => `EN(${x})`));
    expect(r.body).toBe('## EN(标题)\n\n- EN(项目)\n⟦0⟧\n');
    expect(r.fields.title).toBe('EN(T)');
  });
  it('maps engine language codes', () => {
    expect(engineLang('zh-Hant', 'deepl', 'target')).toBe('ZH-HANT');
    expect(engineLang('en-US', 'deepl', 'source')).toBe('EN');
    expect(engineLang('en-US', 'deepl', 'target')).toBe('EN-US');
    expect(engineLang('zh-Hans', 'google', 'target')).toBe('zh-CN');
  });
});
