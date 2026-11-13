import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import { z } from 'zod';

export const lockEntry = z.object({
  sourceHash: z.string(),
  glossaryHash: z.string(),
  promptVersion: z.number(),
  provider: z.string(),
  model: z.string().optional(),
  translatedAt: z.string(),
  outputHash: z.string(),
  edited: z.boolean().optional(),
});
export type LockEntry = z.infer<typeof lockEntry>;

const lockSchema = z.object({
  version: z.literal(1).default(1),
  entries: z.record(z.string(), z.record(z.string(), lockEntry)).default({}),
});
export type Lock = z.infer<typeof lockSchema>;

export const LOCK_PATH = 'i18n/state.lock.yaml';

export function loadLock(root = process.cwd()): Lock {
  const f = resolve(root, LOCK_PATH);
  if (!existsSync(f)) return { version: 1, entries: {} };
  return lockSchema.parse(parse(readFileSync(f, 'utf8')) ?? {});
}

export function saveLock(lock: Lock, root = process.cwd()): void {
  const sorted: Lock = {
    version: 1,
    entries: Object.fromEntries(
      Object.keys(lock.entries)
        .sort()
        .map((k) => [k, Object.fromEntries(Object.entries(lock.entries[k]!).sort(([a], [b]) => a.localeCompare(b)))]),
    ),
  };
  // Write-then-rename so a concurrent reader never sees a truncated file.
  const file = resolve(root, LOCK_PATH);
  const tmp = `${file}.${process.pid}.tmp`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(tmp, '# Managed by `pnpm i18n`. Tracks machine translations; commit this file.\n' + stringify(sorted, { lineWidth: 0 }));
  renameSync(tmp, file);
}

/**
 * Read-modify-write against the file on disk. Never save a lock snapshot loaded earlier:
 * translation runs take minutes, and another run (dev toolbar, a second `pnpm i18n`,
 * `pnpm build`) may have written entries meanwhile; saving a stale snapshot erases them,
 * leaving translation files without entries ("hand-placed").
 */
export function updateLock(root: string, mutate: (lock: Lock) => void): void {
  const lock = loadLock(root);
  mutate(lock);
  saveLock(lock, root);
}

export function lockKey(collection: string, key: string): string {
  return `${collection}/${key}`;
}
