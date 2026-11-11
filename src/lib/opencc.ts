import * as OpenCC from 'opencc-js';

export type Converter = (text: string) => string;

const PRESETS: Record<string, { from: string; to: string }> = {
  s2t: { from: 'cn', to: 't' },
  s2tw: { from: 'cn', to: 'tw' },
  s2twp: { from: 'cn', to: 'twp' },
  s2hk: { from: 'cn', to: 'hk' },
  t2s: { from: 't', to: 'cn' },
  tw2s: { from: 'tw', to: 'cn' },
  tw2sp: { from: 'twp', to: 'cn' },
  hk2s: { from: 'hk', to: 'cn' },
};

const cache = new Map<string, Converter>();

export function openccConverter(preset: string): Converter {
  if (preset === 'identity') return (s) => s;
  let c = cache.get(preset);
  if (!c) {
    const p = PRESETS[preset];
    if (!p) throw new Error(`unknown OpenCC preset ${preset}`);
    c = OpenCC.Converter(p);
    cache.set(preset, c);
  }
  return c;
}
