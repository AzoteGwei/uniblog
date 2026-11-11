import { defineToolbarApp } from 'astro/toolbar';

interface PageStatus {
  found: boolean;
  key?: string;
  collection?: string;
  locale?: string;
  sourceLocale?: string;
  status?: string;
  derivedFrom?: string;
  pending: { locale: string; reason: string }[];
  skipped: { locale: string; reason: string }[];
}

const css = `
  :host { all: initial; }
  .win { position: fixed; bottom: 4.5rem; left: 50%; transform: translateX(-50%); width: min(28rem, 92vw);
         font: 13px/1.5 system-ui, sans-serif; color: #e6e6e6; background: #181a1f; border: 1px solid #343842;
         border-radius: 10px; padding: 14px 16px; box-shadow: 0 12px 40px rgb(0 0 0 / .4); }
  h2 { margin: 0 0 8px; font-size: 14px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 0 0 10px; }
  dt { color: #9aa0ab; } dd { margin: 0; }
  ul { margin: 4px 0 10px; padding-left: 18px; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; }
  button { font: inherit; padding: 5px 10px; border-radius: 6px; border: 1px solid #4b5160; background: #2a2e37; color: #fff; cursor: pointer; }
  button.primary { background: #a94f26; border-color: #a94f26; }
  button:disabled { opacity: .5; cursor: progress; }
  pre { white-space: pre-wrap; max-height: 10rem; overflow: auto; background: #101216; padding: 6px 8px; border-radius: 6px; margin: 8px 0 0; }
  .muted { color: #9aa0ab; }
`;

export default defineToolbarApp({
  init(canvas, app) {
    const style = document.createElement('style');
    style.textContent = css;
    const win = document.createElement('div');
    win.className = 'win';
    canvas.append(style, win);

    async function refresh() {
      const res = await fetch(`/__uniblog/status/?path=${encodeURIComponent(location.pathname)}`);
      const s = (await res.json()) as PageStatus;
      if (!s.found) {
        win.innerHTML = `<h2>uniblog i18n</h2><p class="muted">This page is not a post or page.</p>`;
        return;
      }
      const pending = s.pending.map((p) => `<li>${p.locale} — ${p.reason}</li>`).join('');
      const skipped = s.skipped.map((p) => `<li>${p.locale} — ${p.reason}</li>`).join('');
      const here = s.pending.find((p) => p.locale === s.locale);
      win.innerHTML = `
        <h2>uniblog i18n · ${s.collection}/${s.key}</h2>
        <dl>
          <dt>this page</dt><dd>${s.locale} · <b>${s.status}</b>${s.derivedFrom ? ` (OpenCC from ${s.derivedFrom})` : ''}</dd>
          <dt>source</dt><dd>${s.sourceLocale}</dd>
        </dl>
        ${pending ? `<div>Missing / stale translations:<ul>${pending}</ul></div>` : '<p class="muted">All translations are up to date.</p>'}
        ${skipped ? `<div class="muted">Skipped (edited or hand-placed):<ul>${skipped}</ul></div>` : ''}
        <div class="row">
          ${here ? `<button class="primary" data-locale="${s.locale}">Translate this language</button>` : ''}
          ${pending ? `<button data-all>Translate all (${s.pending.length})</button>` : ''}
          ${skipped ? `<button data-force>Force re-translate all</button>` : ''}
        </div>
        <pre hidden></pre>`;
      win.querySelectorAll('button').forEach((b) =>
        b.addEventListener('click', async () => {
          win.querySelectorAll('button').forEach((x) => (x.disabled = true));
          const out = win.querySelector('pre')!;
          out.hidden = false;
          out.textContent = 'translating…';
          const body = { key: s.key, locale: b.dataset.locale, force: b.hasAttribute('data-force') };
          const r = await fetch('/__uniblog/translate/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
          const j = (await r.json()) as { log: string[]; failed: number };
          out.textContent = j.log.join('\n') || 'nothing to do';
          if (!j.failed) setTimeout(() => location.reload(), 600);
          else win.querySelectorAll('button').forEach((x) => (x.disabled = false));
        }),
      );
    }

    app.onToggled(({ state }) => {
      if (state) refresh();
    });
  },
});
