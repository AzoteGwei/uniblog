import { engineLang, segmentTranslate } from '../segment';
import { ProviderUnavailable, type ProviderRef, type TranslationProvider } from '../types';

/** Google Cloud Translation (Basic, v2) with an API key (GOOGLE_TRANSLATE_API_KEY). */
export function googleProvider(ref: ProviderRef): TranslationProvider {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!key) throw new ProviderUnavailable('GOOGLE_TRANSLATE_API_KEY is not set');
  return {
    id: 'google',
    model: ref.model ?? 'nmt',
    translate: (job) =>
      segmentTranslate(job, async (texts) => {
        // Google's HTML mode keeps tags; <k> is turned into translate="no" spans.
        const q = texts.map((t) => t.replace(/<k>/g, '<span translate="no">').replace(/<\/k>/g, '</span>'));
        const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            q,
            source: engineLang(job.sourceLocale, 'google', 'source'),
            target: engineLang(job.targetLocale, 'google', 'target'),
            format: 'html',
            ...(ref.model ? { model: ref.model } : {}),
          }),
        });
        if (!res.ok) throw new Error(`google ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const j = (await res.json()) as { data: { translations: { translatedText: string }[] } };
        return j.data.translations.map((t) => t.translatedText.replace(/<span translate="no">([\s\S]*?)<\/span>/g, '$1'));
      }),
  };
}
