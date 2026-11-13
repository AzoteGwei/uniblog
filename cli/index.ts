#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { loadSiteConfig } from '../src/lib/config';
import { materialize } from '../src/lib/materialize';
import { existsSync } from 'node:fs';
import { createPost } from './new';
import { captureBin, runBin } from './run';
import { findOrphans, planJobs, pruneOrphans, runJobs } from './translate';
import { resolveLocale } from '../src/lib/locales';
import { statusTable } from './status';

const [cmd = 'help', ...rest] = process.argv.slice(2);

if (existsSync('.env')) process.loadEnvFile('.env');

async function main(): Promise<number> {
  const cfg = loadSiteConfig();
  switch (cmd) {
    case 'new': {
      const { values, positionals } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          title: { type: 'string', short: 't' },
          lang: { type: 'string', short: 'l' },
          page: { type: 'boolean' },
          mdx: { type: 'boolean' },
          single: { type: 'boolean' },
        },
      });
      const slug = positionals[0];
      if (!slug) throw new Error('usage: pnpm new <slug> [--title …] [--lang ja] [--page] [--mdx] [--single]');
      console.log('created', createPost(cfg, { slug, ...values }));
      return 0;
    }
    case 'materialize': {
      const rep = materialize(cfg);
      console.log(`materialized ${rep.items.length} items (${rep.written.length} written, ${rep.removed.length} removed)`);
      return 0;
    }
    case 'status': {
      const { values } = parseArgs({ args: rest, options: { check: { type: 'boolean' } } });
      const rep = materialize(cfg);
      const t = statusTable(rep, Object.keys(cfg.locales));
      console.log(t.text);
      const orphans = findOrphans(cfg, process.cwd());
      if (orphans.files.length || orphans.lockIds.length)
        console.log(`\n${orphans.files.length} orphaned translation file(s), ${orphans.lockIds.length} orphaned lock id(s) — \`pnpm i18n\` removes them.`);
      if (values.check && (t.stale || t.fallback)) {
        console.error(`\n${t.stale} stale, ${t.fallback} fallback`);
        return 1;
      }
      return 0;
    }
    case 'i18n': {
      const { values, positionals } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          locale: { type: 'string', short: 'l', multiple: true },
          provider: { type: 'string', short: 'p' },
          force: { type: 'boolean' },
          'dry-run': { type: 'boolean' },
          concurrency: { type: 'string', short: 'j' },
        },
      });
      const locales = values.locale?.map((l) => {
        const c = resolveLocale(cfg, l);
        if (!c) throw new Error(`unknown locale ${l}`);
        return c;
      });
      // Deleted / renamed sources leave translations and lock entries behind; clean them up.
      const orphans = values['dry-run'] ? findOrphans(cfg, process.cwd()) : pruneOrphans(cfg, process.cwd());
      const verb = values['dry-run'] ? 'would remove' : 'removed';
      for (const f of orphans.files) console.log(`- ${verb} orphaned ${f}`);
      for (const id of orphans.lockIds) console.log(`- ${verb} lock entries for deleted ${id}`);
      const { jobs, skipped } = planJobs(cfg, process.cwd(), { keys: positionals, locales, force: values.force });
      for (const s of skipped)
        console.warn(`! skip ${s.item.collection}/${s.item.key} → ${s.locale}: ${s.reason === 'edited-stale' ? 'source changed but translation was edited/reviewed (use --force to overwrite)' : 'translation file has no lock entry (hand-placed)'}`);
      if (!jobs.length) {
        console.log('translations are up to date');
        return 0;
      }
      console.log(`${jobs.length} translation job(s)`);
      const res = await runJobs(cfg, process.cwd(), jobs, {
        provider: values.provider,
        dryRun: values['dry-run'],
        concurrency: values.concurrency ? Number(values.concurrency) : undefined,
        log: (m) => console.log(m),
      });
      materialize(cfg);
      if (res.failed.length) console.error(`${res.failed.length} job(s) failed`);
      return res.failed.length ? 1 : 0;
    }
    case 'dev': {
      const t = statusTable(materialize(cfg), Object.keys(cfg.locales));
      const pending = planJobs(cfg, process.cwd());
      if (pending.jobs.length || t.stale)
        console.log(`\n${pending.jobs.length} translation(s) missing or stale — run \`pnpm i18n\` or use the dev toolbar.\n`);
      return runBin('astro', ['dev', ...rest]);
    }
    case 'build':
    case 'ship': {
      const { values } = parseArgs({
        args: rest,
        options: {
          strict: { type: 'boolean' },
          'no-translate': { type: 'boolean' },
          translate: { type: 'boolean' },
          provider: { type: 'string', short: 'p' },
          branch: { type: 'string', short: 'b' },
        },
      });
      // CI (GitHub Actions, Cloudflare Pages builds) never translates implicitly: results
      // would be thrown away and cost money on every deploy. Translate in a separate,
      // committing step (see .github/workflows/deploy.yml) or pass --translate.
      const inCI = Boolean(process.env.CI || process.env.CF_PAGES);
      const autoTranslate = values.translate || (!inCI && !values['no-translate'] && cfg.translate.onBuild === 'stale');
      if (inCI && !values.translate) console.log('CI detected: skipping build-time translation (use --translate to force).');
      if (autoTranslate) {
        const { jobs } = planJobs(cfg, process.cwd());
        if (jobs.length) {
          console.log(`translating ${jobs.length} missing/stale item(s) before build…`);
          const res = await runJobs(cfg, process.cwd(), jobs, { provider: values.provider, log: (m) => console.log(m) });
          if (res.failed.length) console.warn(`! ${res.failed.length} translation(s) failed; those pages fall back to the source text.`);
        }
      }
      const t = statusTable(materialize(cfg), Object.keys(cfg.locales));
      if (inCI && (t.stale || t.fallback)) console.log(`${t.stale} stale, ${t.fallback} fallback page(s) in this build.`);
      if (values.strict && (t.stale || t.fallback)) {
        console.log(t.text);
        console.error(`--strict: ${t.stale} stale and ${t.fallback} fallback page(s)`);
        return 1;
      }
      let code = await runBin('astro', ['build']);
      if (code === 0) code = await runBin('pagefind', ['--site', 'dist']);
      if (code !== 0 || cmd === 'build') return code;
      if (!cfg.deploy) throw new Error('site.yaml has no deploy section');
      const { project, productionBranch } = cfg.deploy;
      await ensurePagesProject(project, productionBranch);
      const branch = values.branch ? ['--branch', values.branch] : [];
      return runBin('wrangler', ['pages', 'deploy', 'dist', '--project-name', project, ...branch, '--commit-dirty=true']);
    }
    default:
      console.log('uniblog <new|materialize|status|i18n|dev|build|ship>');
      return cmd === 'help' ? 0 : 1;
  }
}

/** Create the Pages project on first deploy so wrangler never prompts (which hangs in CI). */
async function ensurePagesProject(project: string, productionBranch: string): Promise<void> {
  const list = await captureBin('wrangler', ['pages', 'project', 'list', '--json']);
  if (list.code !== 0) return; // let `pages deploy` surface auth errors itself
  let names: string[] = [];
  try {
    names = (JSON.parse(list.stdout) as Array<Record<string, string>>).map((p) => p['Project Name'] ?? p.name ?? '');
  } catch {
    return;
  }
  if (names.includes(project)) return;
  console.log(`creating Cloudflare Pages project ${project} (production branch: ${productionBranch})`);
  const code = await runBin('wrangler', ['pages', 'project', 'create', project, '--production-branch', productionBranch]);
  if (code !== 0) console.warn(`! could not create Pages project ${project}; trying to deploy anyway`);
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
