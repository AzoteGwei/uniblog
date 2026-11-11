import type { ProviderRef, TranslationProvider } from '../types';
import { geminiProvider } from './gemini';
import { mockProvider } from './mock';

type Factory = (ref: ProviderRef) => TranslationProvider;

const registry: Record<string, Factory> = {
  mock: () => mockProvider(),
  gemini: geminiProvider,
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
