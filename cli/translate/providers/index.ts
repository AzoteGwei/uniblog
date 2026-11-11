import type { ProviderRef, TranslationProvider } from '../types';
import { anthropicProvider } from './anthropic';
import { deeplProvider } from './deepl';
import { geminiProvider } from './gemini';
import { googleProvider } from './google';
import { openaiProvider } from './openai';
import { mockProvider } from './mock';

type Factory = (ref: ProviderRef) => TranslationProvider;

const registry: Record<string, Factory> = {
  mock: () => mockProvider(),
  gemini: geminiProvider,
  anthropic: anthropicProvider,
  openai: openaiProvider,
  deepl: deeplProvider,
  google: googleProvider,
};

export function registerProvider(id: string, f: Factory): void {
  registry[id] = f;
}

export function providerIds(): string[] {
  return Object.keys(registry);
}

/** Instantiates a provider; throws ProviderUnavailable when credentials are missing. */
export function createProvider(ref: ProviderRef): TranslationProvider {
  const f = registry[ref.provider];
  if (!f) throw new Error(`unknown translation provider "${ref.provider}" (known: ${providerIds().join(', ')})`);
  return f(ref);
}
