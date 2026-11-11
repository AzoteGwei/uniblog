import { copyFileSync, existsSync, mkdirSync, statSync, createReadStream } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { loadSiteConfig, type SiteConfig } from '../lib/config';
import { localePath } from '../lib/locales';
import { materialize, type MaterializeReport, type Resolved } from '../lib/materialize';
import type { SourceItem } from '../lib/sources';
import { planJobs, runJobs } from '../../cli/translate/index';

let fallbackUrls = new Set<string>();
/** URL dir (e.g. `/ja/posts/foo/`) → bundle asset absolute paths. */
let assetDirs = new Map<string, string[]>();
/** URL → materialized entry, for the dev toolbar. */
let pages = new Map<string, { item: SourceItem; resolved: Resolved }>();

function routeOf(cfg: SiteConfig, locale: string, collection: string, slug: string): string {
  const base = `/${localePath(cfg, locale)}/`;
  return collection === 'posts' ? `${base}posts/${slug}/` : `${base}${slug}/`;
}

function index(cfg: SiteConfig, rep: MaterializeReport): void {
  fallbackUrls = new Set();
  assetDirs = new Map();
  pages = new Map();
  for (const { item, resolved } of rep.items) {
    for (const r of resolved) {
      const slug = typeof r.doc.data.slug === 'string' ? r.doc.data.slug : item.key;
      const url = routeOf(cfg, r.locale, item.collection, slug);
      pages.set(url, { item, resolved: r });
      if (r.status === 'fallback') fallbackUrls.add(url);
      if (item.assets.length) assetDirs.set(url, item.assets);
    }
  }
}

function run(): MaterializeReport {
  const cfg = loadSiteConfig(process.cwd(), true);
  const rep = materialize(cfg);
  index(cfg, rep);
  return rep;
}

/** Used by the sitemap filter: fallback pages are noindex and excluded. */
export function isFallbackUrl(page: string): boolean {
  return fallbackUrls.has(new URL(page).pathname);
}

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
};

/** Keeps `.uniblog/content` in sync with `content/`, `i18n/` and `site.yaml`; publishes bundle assets. */
export default function uniblog(): AstroIntegration {
  return {
    name: 'uniblog',
    hooks: {
      'astro:config:setup': ({ logger, addDevToolbarApp }) => {
        addDevToolbarApp({
          id: 'uniblog-i18n',
          name: 'Translations',
          icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12.9 15.1 10.4 12.6l.1-.1A17 17 0 0 0 14.1 6H17V4h-7V2H8v2H1v2h11.2A15.7 15.7 0 0 1 9 11.3 15.6 15.6 0 0 1 6.7 8h-2a17.6 17.6 0 0 0 3 4.6l-5.1 5L4 19l5-5 3.1 3.1.8-2Zm5.6-5.1h-2L12 22h2l1.1-3h4.8l1.1 3h2l-4.5-12Zm-2.6 7 1.6-4.3 1.6 4.3h-3.2Z"/></svg>',
          entrypoint: new URL('./toolbar-app.ts', import.meta.url),
        });
        const rep = run();
        logger.info(`materialized ${rep.items.length} items (${rep.written.length} written)`);
      },
      'astro:server:setup': ({ server, logger }) => {
        const watched = /\/(content|i18n)\/|\/site\.yaml$/;
        let timer: NodeJS.Timeout | undefined;
        const onChange = (file: string) => {
          if (!watched.test(file) || file.includes('/.uniblog/')) return;
          clearTimeout(timer);
          timer = setTimeout(() => {
            try {
              const rep = run();
              if (rep.written.length || rep.removed.length)
                logger.info(`re-materialized: ${[...rep.written, ...rep.removed].length} file(s)`);
            } catch (e) {
              logger.error(String(e));
            }
          }, 80);
        };
        server.watcher.add(['content', 'i18n', 'site.yaml']);
        server.watcher.on('add', onChange);
        server.watcher.on('change', onChange);
        server.watcher.on('unlink', onChange);
        // Connect appends middlewares after Astro's router; move ours to the front.
        const front = () => {
          const stack = server.middlewares.stack;
          stack.unshift(stack.pop()!);
        };
        // Dev toolbar API.
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/__uniblog/')) return next();
          const url = new URL(req.url, 'http://x');
          const send = (code: number, data: unknown) => {
            res.statusCode = code;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          };
          try {
            const cfg = loadSiteConfig(process.cwd(), true);
            if (url.pathname === '/__uniblog/status/') {
              const hit = pages.get(url.searchParams.get('path') ?? '');
              if (!hit) return send(200, { found: false, pending: [], skipped: [] });
              const { item, resolved: r } = hit;
              const plan = planJobs(cfg, process.cwd(), { keys: [item.key] });
              const mine = (x: { item: SourceItem }) => x.item.collection === item.collection;
              return send(200, {
                found: true,
                key: item.key,
                collection: item.collection,
                locale: r.locale,
                sourceLocale: item.lang,
                status: r.status,
                derivedFrom: r.derivedFrom,
                pending: plan.jobs.filter(mine).map((j) => ({ locale: j.locale, reason: j.reason })),
                skipped: plan.skipped.filter(mine).map((j) => ({ locale: j.locale, reason: j.reason })),
              });
            }
            if (url.pathname === '/__uniblog/translate/' && req.method === 'POST') {
              let raw = '';
              for await (const chunk of req) raw += chunk;
              const body = JSON.parse(raw || '{}') as { key?: string; locale?: string; force?: boolean };
              if (!body.key) return send(400, { error: 'key required' });
              const plan = planJobs(cfg, process.cwd(), { keys: [body.key], locales: body.locale ? [body.locale] : undefined, force: body.force });
              const log: string[] = [];
              const res2 = await runJobs(cfg, process.cwd(), plan.jobs, { log: (m) => (log.push(m), logger.info(m)) });
              run();
              return send(200, { log, failed: res2.failed.length });
            }
            return send(404, { error: 'not found', path: url.pathname });
          } catch (e) {
            return send(500, { error: String(e), log: [String(e)], failed: 1 });
          }
        });
        front();
        // Serve page-bundle assets (PDFs, downloads, raw images) next to their page.
        server.middlewares.use((req, res, next) => {
          const path = decodeURIComponent((req.url ?? '').split('?')[0]!);
          const dir = path.slice(0, path.lastIndexOf('/') + 1);
          const file = assetDirs.get(dir)?.find((a) => basename(a) === path.slice(dir.length));
          if (!file || !existsSync(file) || statSync(file).isDirectory()) return next();
          res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream');
          createReadStream(file).pipe(res);
        });
        front();
      },
      'astro:build:done': ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        let n = 0;
        for (const [url, assets] of assetDirs) {
          const target = join(out, url);
          if (!existsSync(target)) continue;
          for (const a of assets) {
            if (statSync(a).isDirectory()) continue;
            mkdirSync(target, { recursive: true });
            copyFileSync(a, join(target, basename(a)));
            n++;
          }
        }
        if (n) logger.info(`copied ${n} bundle asset(s)`);
      },
    },
  };
}
