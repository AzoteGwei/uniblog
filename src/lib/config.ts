import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';

const localized = z.record(z.string(), z.string());

const providerRef = z.object({
  provider: z.string(),
  model: z.string().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

const localeSchema = z.object({
  path: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string(),
  dir: z.enum(['ltr', 'rtl']).default('ltr'),
  derive: z
    .object({
      from: z.string(),
      opencc: z.enum(['s2t', 's2tw', 's2twp', 's2hk', 't2s', 'tw2s', 'tw2sp', 'hk2s']),
    })
    .optional(),
});

export const siteSchema = z
  .object({
    title: localized,
    description: localized.default({}),
    author: z.string(),
    url: z.url(),
    defaultLocale: z.string(),
    locales: z.record(z.string(), localeSchema),
    translate: z
      .object({
        zhPivot: z.string().default('zh-Hans'),
        default: providerRef,
        overrides: z.record(z.string(), providerRef).default({}),
        onBuild: z.enum(['stale', 'none']).default('stale'),
      }),
    theme: z
      .object({
        style: z.string().default('paper'),
        styles: z.array(z.string()).default(['paper']),
        compare: z.boolean().default(true),
      })
      .default({ style: 'paper', styles: ['paper'], compare: true }),
    deploy: z
      .object({ provider: z.literal('cloudflare-pages'), project: z.string() })
      .optional(),
    contentLicense: z
      .object({ name: z.string(), url: z.url() })
      .default({ name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }),
  })
  .superRefine((cfg, ctx) => {
    const codes = Object.keys(cfg.locales);
    if (!codes.includes(cfg.defaultLocale))
      ctx.addIssue({ code: 'custom', message: `defaultLocale ${cfg.defaultLocale} not in locales` });
    for (const [code, l] of Object.entries(cfg.locales)) {
      if (l.derive && !codes.includes(l.derive.from))
        ctx.addIssue({ code: 'custom', message: `locale ${code} derives from unknown ${l.derive.from}` });
    }
    const paths = Object.values(cfg.locales).map((l) => l.path);
    if (new Set(paths).size !== paths.length)
      ctx.addIssue({ code: 'custom', message: 'locale paths must be unique' });
    if (!codes.includes(cfg.translate.zhPivot))
      ctx.addIssue({ code: 'custom', message: `translate.zhPivot ${cfg.translate.zhPivot} not in locales` });
  });

export type SiteConfig = z.infer<typeof siteSchema>;
export type LocaleConfig = z.infer<typeof localeSchema>;

export function parseSiteConfig(text: string): SiteConfig {
  return siteSchema.parse(parse(text));
}

let cached: SiteConfig | undefined;
export function loadSiteConfig(root = process.cwd(), fresh = false): SiteConfig {
  if (cached && !fresh) return cached;
  cached = parseSiteConfig(readFileSync(resolve(root, 'site.yaml'), 'utf8'));
  return cached;
}
