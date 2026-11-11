/**
 * Replace untranslatable Markdown spans with ⟦n⟧ placeholders so translation engines
 * cannot damage them, and restore them afterwards.
 */
import type { Node, Parent } from 'unist';
import remarkDirective from 'remark-directive';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

export interface Protected {
  text: string;
  slots: string[];
}

type Range = [number, number];

export const SLOT_RE = /⟦(\d+)⟧/g;

function collect(src: string, mdx: boolean): Range[] {
  const proc = unified().use(remarkParse).use(remarkDirective);
  if (mdx) proc.use(remarkMdx);
  const tree = proc.parse(src);
  const ranges: Range[] = [];
  const pos = (n: Node): Range | undefined =>
    n.position?.start.offset !== undefined && n.position.end.offset !== undefined
      ? [n.position.start.offset, n.position.end.offset]
      : undefined;
  const childSpan = (n: Node): Range | undefined => {
    const kids = (n as Parent).children ?? [];
    const a = kids[0] && pos(kids[0]);
    const b = kids.at(-1) && pos(kids.at(-1)!);
    return a && b ? [a[0], b[1]] : undefined;
  };

  visit(tree, (node: Node) => {
    const r = pos(node);
    if (!r) return;
    switch (node.type) {
      case 'code':
      case 'inlineCode':
      case 'definition':
      case 'math':
      case 'inlineMath':
      case 'mdxjsEsm':
      case 'mdxFlowExpression':
      case 'mdxTextExpression':
        ranges.push(r);
        return 'skip';
      case 'html': {
        const chunk = src.slice(r[0], r[1]);
        if (/^<(script|style|pre)\b/i.test(chunk) || /^<!--/.test(chunk)) {
          ranges.push(r);
          return 'skip';
        }
        for (const m of chunk.matchAll(/<[^>]*>/g)) ranges.push([r[0] + m.index, r[0] + m.index + m[0].length]);
        return 'skip';
      }
      case 'link': {
        const kids = childSpan(node);
        if (kids) ranges.push([kids[1], r[1]]);
        else ranges.push(r);
        return;
      }
      case 'image': {
        const close = src.indexOf('](', r[0]);
        if (close >= 0 && close < r[1]) ranges.push([close, r[1]]);
        return;
      }
      case 'containerDirective':
      case 'leafDirective':
      case 'textDirective': {
        // Keep `:::name`, `{attrs}` and closing fences; translate label and content.
        const head = src.slice(r[0], r[1]).match(/^\s*:+[A-Za-z][\w-]*/);
        if (head) ranges.push([r[0], r[0] + head[0].length]);
        const lineEnd = src.indexOf('\n', r[0]);
        const firstLine = src.slice(r[0], lineEnd < 0 || lineEnd > r[1] ? r[1] : lineEnd);
        const attrs = firstLine.match(/\{[^}]*\}\s*$/);
        if (attrs?.index !== undefined) ranges.push([r[0] + attrs.index, r[0] + attrs.index + attrs[0].length]);
        if (node.type === 'containerDirective') {
          const lastLineStart = src.lastIndexOf('\n', r[1] - 1) + 1;
          if (/^\s*:{3,}\s*$/.test(src.slice(lastLineStart, r[1]))) ranges.push([lastLineStart, r[1]]);
        }
        return;
      }
      case 'mdxJsxFlowElement':
      case 'mdxJsxTextElement': {
        const kids = childSpan(node);
        if (kids) ranges.push([r[0], kids[0]], [kids[1], r[1]]);
        else ranges.push(r);
        return;
      }
    }
  });

  // Bare URLs in prose.
  for (const m of src.matchAll(/https?:\/\/[^\s<>()\]]+/g)) ranges.push([m.index, m.index + m[0].length]);

  // Merge overlaps.
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: Range[] = [];
  for (const r of ranges) {
    const last = merged.at(-1);
    if (last && r[0] < last[1]) last[1] = Math.max(last[1], r[1]);
    else if (r[1] > r[0]) merged.push([...r]);
  }
  return merged;
}

export function protect(src: string, opts: { mdx?: boolean } = {}): Protected {
  const ranges = collect(src, opts.mdx ?? false);
  const slots: string[] = [];
  let text = '';
  let cur = 0;
  for (const [s, e] of ranges) {
    text += src.slice(cur, s) + `⟦${slots.length}⟧`;
    slots.push(src.slice(s, e));
    cur = e;
  }
  return { text: text + src.slice(cur), slots };
}

export class PlaceholderError extends Error {}

/** Verify every slot survived exactly once, then restore. */
export function restore(text: string, slots: string[]): string {
  const seen = new Map<number, number>();
  for (const m of text.matchAll(SLOT_RE)) seen.set(Number(m[1]), (seen.get(Number(m[1])) ?? 0) + 1);
  const missing = slots.map((_, i) => i).filter((i) => seen.get(i) !== 1);
  const extra = [...seen.keys()].filter((i) => i >= slots.length);
  if (missing.length || extra.length)
    throw new PlaceholderError(`placeholder mismatch: missing/duplicated ${missing.join(',') || '-'}, unknown ${extra.join(',') || '-'}`);
  return text.replace(SLOT_RE, (_, i) => slots[Number(i)]!);
}

/** Count of ATX headings outside code (after protection code is a single placeholder). */
export function headingCount(text: string): number {
  return (text.match(/^#{1,6}\s/gm) ?? []).length;
}
