import type { MaterializeReport, Status } from '../src/lib/materialize';

const ICON: Record<Status, string> = {
  source: '●',
  human: '✎',
  reviewed: '✓',
  machine: '⚙',
  stale: '⚠',
  fallback: '✗',
};

export function statusTable(rep: MaterializeReport, locales: string[]): { text: string; stale: number; fallback: number } {
  let stale = 0;
  let fallback = 0;
  const rows: string[][] = [['item', 'src', ...locales]];
  for (const { item, resolved } of rep.items) {
    const by = new Map(resolved.map((r) => [r.locale, r]));
    rows.push([
      `${item.collection}/${item.key}`,
      item.lang,
      ...locales.map((l) => {
        const r = by.get(l);
        if (!r) return '-';
        if (r.status === 'stale') stale++;
        if (r.status === 'fallback') fallback++;
        return `${ICON[r.status]} ${r.status}${r.derivedFrom ? '*' : ''}`;
      }),
    ]);
  }
  const w = rows[0]!.map((_, i) => Math.max(...rows.map((r) => [...r[i]!].length)));
  const text = rows.map((r) => r.map((c, i) => c + ' '.repeat(w[i]! - [...c].length)).join('  ')).join('\n');
  return { text: text + '\n(* = OpenCC-derived from a sibling zh variant)', stale, fallback };
}
