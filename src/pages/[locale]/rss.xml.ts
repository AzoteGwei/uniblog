import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { entryUrl, localePaths, postsIn, siteDescription, siteTitle } from '../../lib/content';

export const getStaticPaths = localePaths;

export async function GET(ctx: APIContext) {
  const locale = ctx.props.locale as string;
  const posts = (await postsIn(locale)).filter((p) => p.data.uniblog.status !== 'fallback');
  return rss({
    title: siteTitle(locale),
    description: siteDescription(locale),
    site: ctx.site!,
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: p.data.summary ?? p.data.description,
      link: entryUrl(p),
      categories: p.data.tags,
    })),
    customData: `<language>${locale}</language>`,
  });
}
