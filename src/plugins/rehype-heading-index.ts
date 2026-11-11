import type { Element, Root } from 'hast';
import { visit } from 'unist-util-visit';

/** Number h2/h3 headings in document order (data-hidx) so bilingual view can align sections. */
export default function rehypeHeadingIndex() {
  return (tree: Root) => {
    let i = 0;
    visit(tree, 'element', (el: Element) => {
      if (el.tagName === 'h2' || el.tagName === 'h3') el.properties['dataHidx'] = String(i++);
    });
  };
}
