import { GoogleGenAI } from '@google/genai';
import { llmTranslate } from '../llm';
import { ProviderUnavailable, type ProviderRef, type TranslationProvider } from '../types';

export function geminiProvider(ref: ProviderRef): TranslationProvider {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new ProviderUnavailable('GEMINI_API_KEY is not set');
  const model = ref.model ?? 'gemini-flash-latest';
  const ai = new GoogleGenAI({ apiKey });
  const temperature = typeof ref.options?.temperature === 'number' ? ref.options.temperature : 0.2;
  return {
    id: 'gemini',
    model,
    translate: (job) =>
      llmTranslate(job, async (system, user) => {
        const res = await ai.models.generateContent({
          model,
          contents: user,
          config: { systemInstruction: system, temperature },
        });
        const text = res.text;
        if (!text) throw new Error(`gemini returned no text (finish: ${res.candidates?.[0]?.finishReason ?? 'unknown'})`);
        return text;
      }),
  };
}
