/**
 * Segment mode for machine-translation APIs (DeepL, Google): translate line by line,
 * with inline Markdown turned into XML/HTML tags the engines preserve.
 */
import { termFor } from '../../src/lib/glossary';
import type { TranslateJob, TranslateResult } from './types';

const PREFIX = /^(\s*(?:#{1,6}\s|[-*+]\s|\d+\.\s|>\s?|⟦\d+⟧\[?|\|)*)(.*)$/;

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function unescapeXml(s: string) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

export function toTagged(text: string, keep: string[]): string {
  let s = escapeXml(text);
  for (const k of keep) s = s.split(escapeXml(k)).join(`<k>${escapeXml(k)}</k>`);
  return s
    .replace(/\[([^\]]*?)⟦(\d+)⟧/g, '<a i="$2">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(?<![*\w])\*(?!\s)(.+?)\*(?![*\w])/g, '<i>$1</i>')
    .replace(/⟦(\d+)⟧/g, '<x i="$1"/>');
}

export function fromTagged(s: string): string {
  return unescapeXml(
    s
      .replace(/<x i="(\d+)"\s*\/>(?:<\/x>)?/g, '⟦$1⟧')
      .replace(/<a i="(\d+)">([\s\S]*?)<\/a>/g, '[$2⟦$1⟧')
      .replace(/<b>([\s\S]*?)<\/b>/g, '**$1**')
      .replace(/<i>([\s\S]*?)<\/i>/g, '*$1*')
      .replace(/<\/?k>/g, ''),
  );
}

/** Translate via a batch function that takes tagged strings and returns tagged strings. */
export async function segmentTranslate(job: TranslateJob, batch: (texts: string[]) => Promise<string[]>): Promise<TranslateResult> {
  const keep = job.glossary.filter((t) => t.dnt === true).map((t) => termFor(t, job.sourceLocale)).filter((x): x is string => !!x);
  const lines = job.body.split('\n');
  const slots: { i: number; prefix: string; text: string }[] = [];
  lines.forEach((line, i) => {
    const m = line.match(PREFIX)!;
    const rest = m[2]!;
    if (!rest.trim() || /^(⟦\d+⟧\s*)+$/.test(rest.trim()) || /^[|:\-\s]+$/.test(rest)) return;
    slots.push({ i, prefix: m[1]!, text: rest });
  });
  const fieldKeys = Object.keys(job.fields);
  const inputs = [...fieldKeys.map((k) => job.fields[k]!), ...slots.map((s) => s.text)].map((t) => toTagged(t, keep));
  const out: string[] = [];
  for (let i = 0; i < inputs.length; i += 40) out.push(...(await batch(inputs.slice(i, i + 40))));
  const fields = Object.fromEntries(fieldKeys.map((k, i) => [k, fromTagged(out[i]!)]));
  slots.forEach((s, j) => (lines[s.i] = s.prefix + fromTagged(out[fieldKeys.length + j]!)));
  return { body: lines.join('\n'), fields };
}

/** Map our locale codes to engine language codes. */
export function engineLang(code: string, engine: 'deepl' | 'google', role: 'source' | 'target'): string {
  const c = code.toLowerCase();
  if (engine === 'deepl') {
    if (c.startsWith('zh')) return role === 'source' ? 'ZH' : /hant|tw|hk/.test(c) ? 'ZH-HANT' : 'ZH-HANS';
    if (c === 'en-us' || c === 'en-gb') return role === 'source' ? 'EN' : c.toUpperCase();
    if (c === 'pt-br' || c === 'pt-pt') return role === 'source' ? 'PT' : c.toUpperCase();
    return c.split('-')[0]!.toUpperCase();
  }
  if (c.startsWith('zh')) return /hant|tw|hk/.test(c) ? 'zh-TW' : 'zh-CN';
  return c.split('-')[0]!;
}
