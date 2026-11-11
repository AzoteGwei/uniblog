import Anthropic from '@anthropic-ai/sdk';
import { llmTranslate } from '../llm';
import { ProviderUnavailable, type ProviderRef, type TranslationProvider } from '../types';

/**
 * Claude via the official SDK. Credentials: ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or an `ant auth login` profile.
 * Server-side refusal fallbacks are enabled (`fallbacks: "default"`); set options.fallbacks: false to disable.
 */
export function anthropicProvider(ref: ProviderRef): TranslationProvider {
  let client: Anthropic;
  try {
    client = new Anthropic();
  } catch (e) {
    throw new ProviderUnavailable(`Anthropic client: ${(e as Error).message}`);
  }
  const model = ref.model ?? 'claude-opus-5-5';
  const effort = (ref.options?.effort as 'low' | 'medium' | 'high' | 'xhigh' | 'max' | undefined) ?? 'medium';
  const useFallbacks = ref.options?.fallbacks !== false;
  return {
    id: 'anthropic',
    model,
    translate: (job) =>
      llmTranslate(job, async (system, user) => {
        const stream = client.beta.messages.stream({
          model,
          max_tokens: 64000,
          system,
          messages: [{ role: 'user', content: user }],
          output_config: { effort },
          ...(useFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        });
        const msg = await stream.finalMessage();
        if (msg.stop_reason === 'refusal') throw new Error(`claude refused (${msg.stop_details?.category ?? 'unknown'})`);
        if (msg.stop_reason === 'max_tokens') throw new Error('claude hit max_tokens; split the post');
        return msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      }),
  };
}
