import mdx from '@astrojs/mdx';
import { rehypeHeadingIds, unified, type RehypePlugins } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import remarkDirective from 'remark-directive';
import uniblog, { isFallbackUrl } from './src/integrations/uniblog';
import { loadSiteConfig } from './src/lib/config';
import rehypeHeadingIndex from './src/plugins/rehype-heading-index';
import remarkShortcodes from './src/plugins/remark-shortcodes';

const site = loadSiteConfig();

const remarkPlugins = [remarkDirective, remarkShortcodes];
const rehypePlugins: RehypePlugins = [
  rehypeHeadingIds,
  [rehypeAutolinkHeadings, { behavior: 'append', properties: { className: ['anchor'], ariaHidden: true, tabIndex: -1 }, content: { type: 'text', value: '#' } }],
  rehypeHeadingIndex,
];

export default defineConfig({
  site: site.url,
  trailingSlash: 'always',
  integrations: [
    uniblog(),
    mdx(),
    sitemap({
      filter: (page) => !isFallbackUrl(page),
      i18n: {
        defaultLocale: site.locales[site.defaultLocale]!.path,
        locales: Object.fromEntries(Object.entries(site.locales).map(([code, l]) => [l.path, code])),
      },
    }),
  ],
  markdown: {
    processor: unified({ remarkPlugins, rehypePlugins, smartypants: false }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  },
});
