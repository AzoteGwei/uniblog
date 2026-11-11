import { llmTranslate } from '../llm';
import { ProviderUnavailable, type ProviderRef, type TranslationProvider } from '../types';

/**
 * Any OpenAI-compatible chat completions endpoint (DeepSeek, OpenRouter, Ollama, vLLM, …).
 * options.baseURL (or OPENAI_BASE_URL), key from options.apiKeyEnv (default OPENAI_API_KEY).
 */
export function openaiProvider(ref: ProviderRef): TranslationProvider {
  const baseURL = String(ref.options?.baseURL ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const keyEnv = String(ref.options?.apiKeyEnv ?? 'OPENAI_API_KEY');
  const apiKey = process.env[keyEnv];
  const local = /localhost|127\.0\.0\.1/.test(baseURL);
  if (!apiKey && !local) throw new ProviderUnavailable(`${keyEnv} is not set`);
  if (!ref.model) throw new ProviderUnavailable('openai provider needs a model in site.yaml');
  const model = ref.model;
  return {
    id: 'openai',
    model,
    translate: (job) =>
      llmTranslate(job, async (system, user) => {
        const res = await fetch(`${baseURL}/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
          body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
        });
        if (!res.ok) throw new Error(`openai-compatible ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = j.choices?.[0]?.message?.content;
        if (!text) throw new Error('openai-compatible endpoint returned no content');
        return text;
      }),
  };
}
