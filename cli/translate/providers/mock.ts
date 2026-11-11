import type { TranslateJob, TranslationProvider } from '../types';

/** Offline pseudo-translator: tags prose lines with the target locale. For tests and dry runs. */
export function mockProvider(): TranslationProvider {
  const tag = (job: TranslateJob, s: string) => (s.trim() ? `[${job.targetLocale}] ${s}` : s);
  return {
    id: 'mock',
    model: 'mock',
    async translate(job) {
      const body = job.body
        .split('\n')
        .map((line) => {
          // Leading Markdown markers, placeholders and a directive label bracket stay in front of the tag.
          const m = line.match(/^(\s*(?:#{1,6}\s|[-*+]\s|\d+\.\s|>\s?|⟦\d+⟧\[?)*)(.*)$/)!;
          const rest = m[2]!;
          if (!rest.trim() || /^⟦\d+⟧$/.test(rest.trim()) || /^[|:\-\s]+$/.test(rest)) return line;
          return m[1] + tag(job, rest);
        })
        .join('\n');
      const fields = Object.fromEntries(Object.entries(job.fields).map(([k, v]) => [k, tag(job, v)]));
      return { body, fields };
    },
  };
}
