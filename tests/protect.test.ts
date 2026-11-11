import { describe, expect, it } from 'vitest';
import { headingCount, PlaceholderError, protect, restore } from '../cli/translate/protect';

const sample = `# 标题

正文 \`code\` 和 [链接](https://example.com/a "t") 以及 ![图](./a.png)。

\`\`\`js
const x = '中文';
\`\`\`

<kbd>Ctrl</kbd> 访问 https://example.com/x 。

:::note[提示标题]{.wide}
内容
:::

::figure[说明文字]{src="./b.png"}
`;

describe('protect', () => {
  it('round-trips byte-for-byte', () => {
    const p = protect(sample);
    expect(restore(p.text, p.slots)).toBe(sample);
  });
  it('hides code, urls, tags and directive syntax but keeps prose', () => {
    const { text } = protect(sample);
    expect(text).not.toContain('const x');
    expect(text).not.toContain('example.com');
    expect(text).not.toContain('<kbd>');
    expect(text).not.toContain(':::note');
    expect(text).not.toContain('{src=');
    for (const s of ['标题', '正文', '链接', '图', '提示标题', '内容', '说明文字', 'Ctrl']) expect(text).toContain(s);
    expect(headingCount(text)).toBe(1);
  });
  it('handles MDX', () => {
    const src = 'import A from "./a"\n\n<A x="1">文字 {1 + 1}</A>\n';
    const p = protect(src, { mdx: true });
    expect(p.text).toContain('文字');
    expect(p.text).not.toContain('import');
    expect(p.text).not.toContain('x="1"');
    expect(restore(p.text, p.slots)).toBe(src);
  });
  it('rejects lost or duplicated placeholders', () => {
    const p = protect(sample);
    expect(() => restore(p.text.replace('⟦0⟧', ''), p.slots)).toThrow(PlaceholderError);
    expect(() => restore(p.text + '⟦0⟧', p.slots)).toThrow(PlaceholderError);
  });
});
