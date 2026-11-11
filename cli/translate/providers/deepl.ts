import { engineLang, segmentTranslate } from '../segment';
import { ProviderUnavailable, type ProviderRef, type TranslationProvider } from '../types';

/** DeepL REST API (free keys end with ":fx" and use api-free.deepl.com). */
export function deeplProvider(ref: ProviderRef): TranslationProvider {
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new ProviderUnavailable('DEEPL_API_KEY is not set');
  const host = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  const formality = ref.options?.formality as string | undefined;
  return {
    id: 'deepl',
    model: ref.model,
    translate: (job) =>
      segmentTranslate(job, async (text) => {
        const res = await fetch(`${host}/v2/translate`, {
          method: 'POST',
          headers: { authorization: `DeepL-Auth-Key ${key}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            text,
            source_lang: engineLang(job.sourceLocale, 'deepl', 'source'),
            target_lang: engineLang(job.targetLocale, 'deepl', 'target'),
            tag_handling: 'xml',
            ignore_tags: ['k', 'x'],
            ...(formality ? { formality } : {}),
          }),
        });
        if (!res.ok) throw new Error(`deepl ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const j = (await res.json()) as { translations: { text: string }[] };
        return j.translations.map((t) => t.text);
      }),
  };
}
