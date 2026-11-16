/** Shared prompt/response handling for document-mode (LLM) providers. */
import { termFor } from '../../src/lib/glossary';
import type { TranslateJob, TranslateResult } from './types';

export const PROMPT_VERSION = 2;
const MAX_CHUNK = 9000;

export type Complete = (system: string, user: string) => Promise<string>;

const LANG_NAMES: Record<string, string> = {
  'zh-Hans': 'Simplified Chinese',
  'zh-Hant': 'Traditional Chinese (Taiwan)',
  'en-US': 'American English',
  ja: 'Japanese',
};
const langName = (code: string) => LANG_NAMES[code] ?? code;

export function systemPrompt(job: TranslateJob): string {
  const lines = [
    `You are a professional technical translator. Translate a blog post from ${langName(job.sourceLocale)} (${job.sourceLocale}) to ${langName(job.targetLocale)} (${job.targetLocale}).`,
    '',
    'Rules:',
    '- Output only the translation in the exact section format you receive. No commentary, no code fences around the output.',
    '- Lines like =====FIELD title===== and =====BODY===== are structural markers: copy each one verbatim on its own line, in the same order. Never translate, reformat or omit them.',
    '- Placeholders like ⟦12⟧ stand for code, URLs, HTML tags or shortcode syntax. Copy every placeholder exactly once, unchanged, at the matching position.',
    '- Preserve Markdown structure: the same headings (same count and levels), lists, tables, emphasis, blank lines and line breaks between blocks.',
    '- Translate naturally and idiomatically for a technical audience; do not add or omit content.',
  ];
  const terms = job.glossary
    .map((t) => {
      const src = termFor(t, job.sourceLocale);
      if (!src) return undefined;
      if (t.dnt === true) return `- "${src}" → keep as "${src}" (do not translate)`;
      const dst = termFor(t, job.targetLocale);
      const note = typeof t.note === 'string' ? ` (${t.note})` : '';
      return dst ? `- "${src}" → "${dst}"${note}` : undefined;
    })
    .filter(Boolean);
  if (terms.length) lines.push('', 'Glossary (must be used consistently):', ...(terms as string[]));
  if (job.notes) lines.push('', `Author notes: ${job.notes}`);
  return lines.join('\n');
}

const FIELD = (k: string) => `=====FIELD ${k}=====`;
const BODY = '=====BODY=====';

export function encode(fields: Record<string, string>, body: string): string {
  const parts = Object.entries(fields).map(([k, v]) => `${FIELD(k)}\n${v}`);
  return [...parts, `${BODY}\n${body}`].join('\n');
}

/**
 * Section marker as models actually emit it: exact `=====BODY=====`, but also full-width `＝`,
 * extra spaces, other case, wrapped in `**`/`#`, or with the BODY label translated (`=====本文=====`).
 * Group 1 = field name; group 2 = any other label, which is taken as BODY.
 */
const MARK = /^[ \t>*_#`]*[=＝]{3,}[ \t]*(?:FIELD[ \t]+([\w-]+)|(?!FIELD\b)([^\n=＝]*[^\s=＝][^\n=＝]*?))[ \t]*[=＝]{3,}[ \t*_`]*\r?$/gim;

export function decode(out: string, expectFields: string[]): TranslateResult {
  const text = out.replace(/^\s*```[a-z]*\n([\s\S]*)\n```\s*$/i, '$1');
  const fields: Record<string, string> = {};
  let body: string | undefined;
  const marks: RegExpMatchArray[] = [];
  for (const m of text.matchAll(MARK)) {
    marks.push(m);
    if (m[1] === undefined) break; // BODY is last: anything below it, marker-like or not, is body
  }
  marks.forEach((m, i) => {
    const start = m.index! + m[0].length + 1;
    const end = marks[i + 1]?.index ?? text.length;
    const value = text.slice(start, end).replace(/\n$/, '');
    if (m[1] !== undefined) fields[m[1].toLowerCase()] = value.trim();
    else body = value;
  });
  if (body === undefined) {
    const last = marks.at(-1);
    if (!marks.length && !expectFields.length) {
      // Continuation chunk whose only marker was dropped: the whole reply is the body.
      body = text.replace(/\n$/, '');
    } else if (last?.[1] !== undefined) {
      // BODY marker dropped after the last field: fields are single-line, the rest is body.
      const key = last[1].toLowerCase();
      const [first, ...rest] = fields[key]!.split('\n');
      if (rest.length) {
        fields[key] = first!.trim();
        body = rest.join('\n').replace(/^\s*\n/, '');
      }
    }
  }
  if (body === undefined) throw new Error(`model output is missing the BODY section; output starts: ${JSON.stringify(out.slice(0, 200))}`);
  const missing = expectFields.filter((f) => !(f in fields));
  if (missing.length) throw new Error(`model output is missing fields: ${missing.join(', ')}; output starts: ${JSON.stringify(out.slice(0, 200))}`);
  return { body, fields };
}

/** Split at H2 boundaries so each chunk stays under MAX_CHUNK chars. */
export function chunkBody(body: string, max = MAX_CHUNK): string[] {
  if (body.length <= max) return [body];
  const sections = body.split(/(?=^## )/m);
  const chunks: string[] = [];
  let cur = '';
  for (const s of sections) {
    if (cur && cur.length + s.length > max) {
      chunks.push(cur);
      cur = '';
    }
    cur += s;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

export async function llmTranslate(job: TranslateJob, complete: Complete): Promise<TranslateResult> {
  const system = systemPrompt(job);
  const chunks = chunkBody(job.body);
  let fields: Record<string, string> = {};
  const bodies: string[] = [];
  for (const [i, chunk] of chunks.entries()) {
    const f = i === 0 ? job.fields : {};
    const ctx = chunks.length > 1 ? `\n\n(This is part ${i + 1} of ${chunks.length} of the post.)` : '';
    const out = await complete(system + ctx, encode(f, chunk));
    const r = decode(out, Object.keys(f));
    if (i === 0) fields = r.fields;
    // Keep the chunk's original trailing whitespace so joins stay intact.
    const trail = chunk.match(/\s*$/)![0];
    bodies.push(r.body.replace(/\s*$/, '') + trail);
  }
  return { body: bodies.join(''), fields };
}
