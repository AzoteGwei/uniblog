import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Run a locally installed binary (node_modules/.bin) with inherited stdio. */
export function runBin(bin: string, args: string[], env: NodeJS.ProcessEnv = {}): Promise<number> {
  const local = resolve('node_modules/.bin', bin);
  const cmd = existsSync(local) ? local : bin;
  return new Promise((ok, fail) => {
    const child = spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
    const forward = (sig: NodeJS.Signals) => child.kill(sig);
    process.on('SIGINT', forward);
    process.on('SIGTERM', forward);
    child.on('error', fail);
    child.on('exit', (code, signal) => {
      process.off('SIGINT', forward);
      process.off('SIGTERM', forward);
      ok(code ?? (signal ? 1 : 0));
    });
  });
}

/** Run a locally installed binary and capture its stdout (stderr is inherited). */
export function captureBin(bin: string, args: string[]): Promise<{ code: number; stdout: string }> {
  const local = resolve('node_modules/.bin', bin);
  const cmd = existsSync(local) ? local : bin;
  return new Promise((ok, fail) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = '';
    child.stdout.setEncoding('utf8').on('data', (d: string) => (stdout += d));
    child.on('error', fail);
    child.on('exit', (code) => ok({ code: code ?? 1, stdout }));
  });
}
