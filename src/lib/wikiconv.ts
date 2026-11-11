/**
 * Wikipedia-style Chinese variant conversion for Markdown bodies.
 *
 * - Plain text is converted with OpenCC.
 * - `-{zh-hans:内存;zh-hant:記憶體;}-` picks the value for the target variant.
 * - `-{literal}-` is emitted verbatim (no conversion).
 * - Code, inline code, HTML tags, link/image destinations, definitions and MDX
 *   syntax are left untouched. Offsets come from the mdast so the original
 *   Markdown formatting is preserved byte-for-byte outside converted text.
 */
import type { Node, Parent } from 'unist';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import type { Converter } from './opencc';

export interface ZhTerm {
  /** variant key (zh-hans, zh-hant, zh-tw, …) → term */
  [variant: string]: string;
}

export interface WikiConvOptions {
  /** Target locale code, e.g. `zh-Hant`, `zh-TW`. */
  target: string;
  /** OpenCC converter from the source script to the target script (identity for same script). */
  convert: Converter;
  /** Global manual conversion pairs (glossary `opencc:` section). */
  terms?: ZhTerm[];
  /** Source locale code; used to pick which side of `terms` to match. */
  source?: string;
  mdx?: boolean;
}

type Range = [number, number];

const VARIANT_KEY = /^zh(?:-[a-z]{2,4})?$/i;

/** Ordered list of variant keys acceptable for a target locale. */
export function variantChain(target: string): string[] {
  const t = target.toLowerCase();
  const hant = /-(hant|tw|hk|mo)\b/.test(t);
  const region = t.match(/-(tw|hk|mo|cn|sg|my)\b/)?.[1];
  const base = hant ? ['zh-hant', 'zh-tw', 'zh-hk', 'zh-mo'] : ['zh-hans', 'zh-cn', 'zh-sg', 'zh-my'];
  const chain = [t, ...(region ? [`zh-${region}`] : []), ...base];
  return [...new Set(chain)];
}

/** Parse the inside of a `-{ … }-` rule. Returns undefined for literal rules. */
export function parseRule(inner: string): Map<string, string> | undefined {
  const parts = inner.split(';').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  const map = new Map<string, string>();
  for (const p of parts) {
    const i = p.indexOf(':');
    if (i < 0) return undefined;
    const key = p.slice(0, i).trim();
    if (!VARIANT_KEY.test(key)) return undefined;
    map.set(key.toLowerCase(), p.slice(i + 1).trim());
  }
  return map;
}

/** Resolve a rule body for a target. `convert` is applied only when falling back across scripts. */
export function resolveRule(inner: string, target: string, convert: Converter): string {
  const map = parseRule(inner);
  if (!map) return inner;
  for (const k of variantChain(target)) {
    const v = map.get(k);
    if (v !== undefined) return v;
  }
  const same = map.get('zh');
  if (same !== undefined) return convert(same);
  return convert(map.values().next().value ?? '');
}

const RULE_RE = /-\{([\s\S]*?)\}-/g;

function collectProtected(src: string, mdx: boolean): { ranges: Range[]; htmlRanges: Range[] } {
  const proc = unified().use(remarkParse);
  if (mdx) proc.use(remarkMdx);
  const tree = proc.parse(src);
  const ranges: Range[] = [];
  const htmlRanges: Range[] = [];
  const pos = (n: Node): Range | undefined =>
    n.position?.start.offset !== undefined && n.position.end.offset !== undefined
      ? [n.position.start.offset, n.position.end.offset]
      : undefined;

  visit(tree, (node: Node) => {
    const r = pos(node);
    if (!r) return;
    switch (node.type) {
      case 'code':
      case 'inlineCode':
      case 'definition':
      case 'mdxjsEsm':
      case 'mdxFlowExpression':
      case 'mdxTextExpression':
        ranges.push(r);
        return 'skip';
      case 'html':
        htmlRanges.push(r);
        return 'skip';
      case 'link':
      case 'linkReference': {
        const kids = (node as Parent).children;
        const last = kids.at(-1);
        const end = last ? pos(last)?.[1] : undefined;
        if (end !== undefined && end < r[1]) ranges.push([end, r[1]]);
        return;
      }
      case 'image': {
        const close = src.indexOf('](', r[0]);
        if (close >= 0 && close < r[1]) ranges.push([close, r[1]]);
        return;
      }
      case 'mdxJsxFlowElement':
      case 'mdxJsxTextElement': {
        const kids = (node as Parent).children;
        const first = kids[0] ? pos(kids[0]) : undefined;
        const last = kids.at(-1) ? pos(kids.at(-1)!) : undefined;
        if (first && last) {
          ranges.push([r[0], first[0]], [last[1], r[1]]);
        } else ranges.push(r);
        return;
      }
    }
  });
  // Inside raw HTML, protect tags but convert text between them.
  for (const [s, e] of htmlRanges) {
    const chunk = src.slice(s, e);
    for (const m of chunk.matchAll(/<[^>]*>/g)) ranges.push([s + m.index, s + m.index + m[0].length]);
    const sc = chunk.match(/<(script|style)\b[\s\S]*?<\/\1>/i);
    if (sc?.index !== undefined) ranges.push([s + sc.index, s + sc.index + sc[0].length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  return { ranges, htmlRanges };
}

function inside(ranges: Range[], s: number, e: number): boolean {
  return ranges.some(([a, b]) => s < b && e > a);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build a converter for plain text that honours glossary terms before OpenCC. */
export function termAwareConverter(opts: Pick<WikiConvOptions, 'convert' | 'terms' | 'source' | 'target'>): Converter {
  const terms = opts.terms ?? [];
  if (terms.length === 0) return opts.convert;
  const srcChain = variantChain(opts.source ?? 'zh-Hans');
  const tgtChain = variantChain(opts.target);
  const pick = (t: ZhTerm, chain: string[]) => {
    const lower = Object.fromEntries(Object.entries(t).map(([k, v]) => [k.toLowerCase(), v]));
    for (const k of chain) if (lower[k] !== undefined) return lower[k];
    return undefined;
  };
  const pairs = new Map<string, string>();
  for (const t of terms) {
    const from = pick(t, srcChain);
    const to = pick(t, tgtChain);
    if (from && to) pairs.set(from, to);
  }
  if (pairs.size === 0) return opts.convert;
  const re = new RegExp([...pairs.keys()].sort((a, b) => b.length - a.length).map(escapeRe).join('|'), 'g');
  return (text) => {
    let out = '';
    let last = 0;
    for (const m of text.matchAll(re)) {
      out += opts.convert(text.slice(last, m.index)) + pairs.get(m[0]);
      last = m.index + m[0].length;
    }
    return out + opts.convert(text.slice(last));
  };
}

/** Convert a plain string (titles, descriptions); supports rules but not Markdown. */
export function convertZhText(text: string, opts: WikiConvOptions): string {
  const conv = termAwareConverter(opts);
  let out = '';
  let last = 0;
  for (const m of text.matchAll(RULE_RE)) {
    out += conv(text.slice(last, m.index)) + resolveRule(m[1]!, opts.target, opts.convert);
    last = m.index + m[0].length;
  }
  return out + conv(text.slice(last));
}

/** Convert a Markdown/MDX body (without front matter). */
export function convertZhMarkdown(src: string, opts: WikiConvOptions): string {
  const conv = termAwareConverter(opts);
  const { ranges } = collectProtected(src, opts.mdx ?? false);

  type Seg = { s: number; e: number; kind: 'keep' | 'rule' };
  const segs: Seg[] = ranges.map(([s, e]) => ({ s, e, kind: 'keep' as const }));
  for (const m of src.matchAll(RULE_RE)) {
    const s = m.index;
    const e = s + m[0].length;
    if (!inside(ranges, s, e)) segs.push({ s, e, kind: 'rule' });
  }
  segs.sort((a, b) => a.s - b.s);

  let out = '';
  let cur = 0;
  for (const seg of segs) {
    if (seg.e <= cur) continue;
    const s = Math.max(seg.s, cur);
    out += conv(src.slice(cur, s));
    if (seg.kind === 'keep') out += src.slice(s, seg.e);
    else out += resolveRule(src.slice(seg.s + 2, seg.e - 2), opts.target, opts.convert);
    cur = seg.e;
  }
  return out + conv(src.slice(cur));
}
