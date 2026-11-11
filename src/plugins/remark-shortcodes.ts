/**
 * Hugo/Hexo-style shortcodes written as Markdown directives (remark-directive):
 *
 *   :::note[Optional title]   (note | tip | info | warning | danger)
 *   :::details[Summary]
 *   ::::tabs  +  :::tab[Label]   (outer fence needs more colons)
 *   :::steps
 *   ::figure[Caption (translated)]{src="./a.png" alt="…"}
 *   ::youtube{id="…"}
 */
import type { Paragraph, PhrasingContent, Root, RootContent } from 'mdast';
import type {} from 'mdast-util-to-hast';
import type { ContainerDirective, LeafDirective, TextDirective } from 'mdast-util-directive';
import { visit } from 'unist-util-visit';
import type { VFile } from 'vfile';
import { loadSiteConfig } from '../lib/config';
import { t } from '../lib/ui';

const CALLOUTS = new Set(['note', 'tip', 'info', 'warning', 'danger', 'caution']);
type Directive = ContainerDirective | LeafDirective | TextDirective;

function localeOf(file: VFile): string {
  const cfg = loadSiteConfig();
  const m = String(file.path ?? '').match(/\.uniblog\/content\/([^/]+)\//);
  const hit = m && Object.entries(cfg.locales).find(([, l]) => l.path === m[1]);
  return hit ? hit[0] : cfg.defaultLocale;
}

function setH(node: { data?: object }, hName: string, hProperties: Record<string, unknown> = {}) {
  node.data = { ...(node.data ?? {}), hName, hProperties } as object;
}

/** Container directives keep their `[label]` as a first paragraph flagged with directiveLabel. */
function takeLabel(node: ContainerDirective): PhrasingContent[] | undefined {
  const first = node.children[0] as Paragraph | undefined;
  if (first?.type === 'paragraph' && (first.data as { directiveLabel?: boolean } | undefined)?.directiveLabel) {
    node.children.shift();
    return first.children;
  }
  return undefined;
}

export default function remarkShortcodes() {
  return (tree: Root, file: VFile) => {
    const locale = localeOf(file);
    let tabGroup = 0;
    visit(tree, (node) => {
      if (node.type !== 'containerDirective' && node.type !== 'leafDirective' && node.type !== 'textDirective') return;
      const d = node as Directive;
      const attrs = (d.attributes ?? {}) as Record<string, string | undefined>;

      if ((d.data as { hName?: string } | undefined)?.hName) return; // already handled (e.g. a tab panel)
      if (d.type === 'containerDirective' && CALLOUTS.has(d.name)) {
        const label = takeLabel(d);
        const title: Paragraph = {
          type: 'paragraph',
          children: label ?? [{ type: 'text', value: t(locale, `callout.${d.name}`) }],
          data: { hName: 'p', hProperties: { className: ['callout-title'] } },
        };
        d.children.unshift(title);
        setH(d, 'aside', { className: ['callout', `callout-${d.name}`], role: 'note' });
        return;
      }
      if (d.type === 'containerDirective' && d.name === 'details') {
        const label = takeLabel(d);
        d.children.unshift({
          type: 'paragraph',
          children: label ?? [{ type: 'text', value: '…' }],
          data: { hName: 'summary' },
        });
        setH(d, 'details', attrs.open !== undefined ? { open: true } : {});
        return;
      }
      if (d.type === 'containerDirective' && d.name === 'steps') {
        setH(d, 'div', { className: ['steps'] });
        return;
      }
      if (d.type === 'containerDirective' && d.name === 'tabs') {
        const group = `tabs-${++tabGroup}`;
        const panels = d.children.filter((c): c is ContainerDirective => c.type === 'containerDirective' && c.name === 'tab');
        const out: RootContent[] = [];
        panels.forEach((p, i) => {
          const label = takeLabel(p) ?? [{ type: 'text', value: `Tab ${i + 1}` }];
          const id = `${group}-${i}`;
          out.push({
            type: 'paragraph',
            children: [],
            data: { hName: 'input', hProperties: { type: 'radio', name: group, id, checked: i === 0, className: ['tab-radio'] } },
          } as Paragraph);
          out.push({ type: 'paragraph', children: label, data: { hName: 'label', hProperties: { htmlFor: [id], className: ['tab-label'] } } });
          setH(p, 'div', { className: ['tab-panel'] });
          out.push(p);
        });
        d.children = out as ContainerDirective['children'];
        setH(d, 'div', { className: ['tabs'] });
        return;
      }
      if (d.type === 'leafDirective' && d.name === 'figure' && attrs.src) {
        const fig = d as unknown as { type: string; children: PhrasingContent[]; data?: Record<string, unknown> };
        const label = fig.children.length ? fig.children : attrs.caption ? [{ type: 'text', value: attrs.caption } as PhrasingContent] : [];
        const alt = attrs.alt ?? label.map((c) => ('value' in c ? c.value : '')).join('');
        fig.children = [
          { type: 'image', url: attrs.src, alt, title: null },
          ...(label.length ? [{ type: 'paragraph', children: label, data: { hName: 'figcaption' } }] : []),
        ] as unknown as PhrasingContent[];
        setH(fig, 'figure');
        return;
      }
      if (d.type === 'leafDirective' && d.name === 'youtube' && attrs.id) {
        setH(d, 'div', { className: ['embed'] });
        (d as LeafDirective).children = [
          {
            type: 'text',
            value: '',
            data: {
              hName: 'iframe',
              hProperties: {
                src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(attrs.id)}`,
                title: attrs.title ?? 'YouTube',
                loading: 'lazy',
                allow: 'encrypted-media; picture-in-picture',
                allowFullScreen: true,
              },
            },
          } as PhrasingContent,
        ];
        return;
      }
      // Unknown text/leaf directive (e.g. "ratio 16:9" parses as `:9`): restore the original source text.
      if (d.type !== 'containerDirective') {
        const start = d.position?.start.offset;
        const end = d.position?.end.offset;
        const raw = start !== undefined && end !== undefined ? String(file.value).slice(start, end) : `:${d.name}`;
        const replacement = { type: 'text', value: raw };
        if (d.type === 'textDirective') Object.assign(d, replacement, { children: undefined, attributes: undefined, name: undefined });
        else Object.assign(d, { type: 'paragraph', children: [replacement], attributes: undefined, name: undefined });
        return 'skip';
      }
      setH(d, 'div', { className: ['directive', `directive-${d.name}`] });
    });
  };
}
