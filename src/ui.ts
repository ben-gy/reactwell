// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/**
 * App shell + chrome: header, two-pane workspace, drop zone, resizable splitter,
 * off-canvas event drawer, and the How-it-works / Privacy / About modals.
 * Pure DOM construction — no tool logic lives here.
 */
import { gloss } from './glossary';

export interface Shell {
  editorHost: HTMLElement;
  previewHost: HTMLElement;
  drawerHost: HTMLElement;
  statusEl: HTMLElement;
  fileBadge: HTMLElement;
  buttons: {
    samples: HTMLButtonElement;
    open: HTMLButtonElement;
    share: HTMLButtonElement;
    reset: HTMLButtonElement;
    drawerToggle: HTMLButtonElement;
    how: HTMLButtonElement;
    privacy: HTMLButtonElement;
    about: HTMLButtonElement;
  };
  cdnToggle: HTMLInputElement;
  workspace: HTMLElement;
  dropOverlay: HTMLElement;
}

export function buildShell(root: HTMLElement): Shell {
  root.innerHTML = `
    <header class="topbar">
      <a class="brand" href="/" aria-label="Reactwell home">
        <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="7" fill="#11151f"/>
          <g fill="none" stroke="#61dafb" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 11 L7 16 L12 21"/><path d="M20 11 L25 16 L20 21"/>
          </g>
          <ellipse cx="16" cy="16" rx="3.4" ry="1.4" fill="none" stroke="#61dafb" stroke-width="1.3" transform="rotate(60 16 16)"/>
          <circle cx="16" cy="16" r="1.5" fill="#61dafb"/>
        </svg>
        <span class="brand-name">Reactwell</span>
      </a>
      <nav class="topnav">
        <button type="button" class="nav-btn" id="btn-samples">Samples</button>
        <button type="button" class="nav-btn" id="btn-open">Open file</button>
        <button type="button" class="nav-btn" id="btn-share">Share</button>
        <span class="nav-sep" aria-hidden="true"></span>
        <button type="button" class="nav-btn" id="btn-how">How it works</button>
        <button type="button" class="nav-btn" id="btn-privacy">Privacy</button>
        <button type="button" class="nav-btn" id="btn-about">About</button>
      </nav>
    </header>

    <div class="trust-banner" id="trust-banner">
      <span class="trust-dot" aria-hidden="true"></span>
      <span>Runs entirely in your browser — your ${gloss('jsx', 'JSX')} is transpiled on-device and never uploaded.</span>
      <button type="button" class="trust-more" id="trust-more">How?</button>
      <button type="button" class="trust-x" id="trust-x" aria-label="Dismiss">×</button>
    </div>

    <main class="main-content">
      <div class="workspace" id="workspace">
        <section class="pane editor-pane">
          <div class="pane-head">
            <span class="pane-title">Editor</span>
            <span class="file-badge" id="file-badge" hidden></span>
            <span class="pane-note">${gloss('jsx', 'JSX')} / ${gloss('tsx', 'TSX')} · auto-renders</span>
          </div>
          <div class="editor-host" id="editor-host"></div>
        </section>

        <div class="splitter" id="splitter" role="separator" aria-orientation="vertical" tabindex="0"></div>

        <section class="pane preview-pane">
          <div class="pane-head">
            <span class="pane-title">Preview</span>
            <span class="status" id="status" aria-live="polite">ready</span>
            <span class="pane-spacer"></span>
            <label class="cdn-toggle" title="Resolve non-React imports from esm.sh">
              <input type="checkbox" id="cdn-toggle" />
              <span>Fetch extra libraries</span>
            </label>
            <button type="button" class="icon-btn" id="btn-reset" title="Reset the preview">reset</button>
            <button type="button" class="icon-btn" id="btn-drawer" title="Toggle event log" aria-expanded="false">log</button>
          </div>
          <div class="preview-host" id="preview-host"></div>
        </section>
      </div>
    </main>

    <aside class="event-drawer" id="event-drawer" aria-hidden="true"></aside>

    <footer class="site-footer">
      <div class="footer-inner">
        Built by <a href="https://benrichardson.dev/" target="_blank" rel="noopener">benrichardson.dev</a>
        · <a href="https://lab.benrichardson.dev" target="_blank" rel="noopener">more tools &amp; sites</a>
      </div>
    </footer>

    <div class="drop-overlay" id="drop-overlay" hidden>
      <div class="drop-inner">
        <div class="drop-icon" aria-hidden="true">⤓</div>
        <div class="drop-text">Drop a <strong>.jsx</strong>, <strong>.tsx</strong>, <strong>.js</strong> or <strong>.ts</strong> file to load it</div>
      </div>
    </div>

    <div class="modal-root" id="modal-root"></div>
  `;

  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;

  return {
    editorHost: $('editor-host'),
    previewHost: $('preview-host'),
    drawerHost: $('event-drawer'),
    statusEl: $('status'),
    fileBadge: $('file-badge'),
    buttons: {
      samples: $('btn-samples'),
      open: $('btn-open'),
      share: $('btn-share'),
      reset: $('btn-reset'),
      drawerToggle: $('btn-drawer'),
      how: $('btn-how'),
      privacy: $('btn-privacy'),
      about: $('btn-about'),
    },
    cdnToggle: $('cdn-toggle'),
    workspace: $('workspace'),
    dropOverlay: $('drop-overlay'),
  };
}

// ── Modals ──────────────────────────────────────────────────────────────────

let openModalEl: HTMLElement | null = null;

export function closeModal(): void {
  if (openModalEl) {
    openModalEl.remove();
    openModalEl = null;
  }
}

export function openModal(title: string, bodyHtml: string): void {
  closeModal();
  const modalRoot = document.getElementById('modal-root')!;
  const wrap = document.createElement('div');
  wrap.className = 'modal-scrim';
  wrap.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-head">
        <h2>${title}</h2>
        <button type="button" class="modal-close" aria-label="Close">×</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
    </div>`;
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || (e.target as HTMLElement).closest('.modal-close')) closeModal();
  });
  modalRoot.appendChild(wrap);
  openModalEl = wrap;
}

export function howItWorksHtml(): string {
  return `
    <p>Reactwell is a scratchpad for React components. Paste or drop code and it renders — no <code>npm install</code>, no dev server, no build step you have to run.</p>
    <ol class="steps">
      <li><strong>You write ${gloss('jsx', 'JSX')} or ${gloss('tsx', 'TSX')}.</strong> Write a component and <code>export default</code> it. Modern JSX works with no <code>import React</code> line.</li>
      <li><strong>${gloss('esbuild', 'esbuild')} transpiles it in a ${gloss('wasm', 'WebAssembly')} worker.</strong> Your JSX/TypeScript becomes plain JavaScript entirely on your machine — the compiler runs in a background thread so typing stays smooth.</li>
      <li><strong>React is supplied locally.</strong> The React &amp; ReactDOM runtimes ship inside this page. An ${gloss('import-map', 'import map')} wires <code>import … from 'react'</code> to them, so it all works offline.</li>
      <li><strong>Your component mounts in a ${gloss('sandbox', 'sandboxed')} ${gloss('iframe', 'iframe')}.</strong> The default export is rendered in an isolated frame. A crash or thrown error is caught and shown as an overlay instead of taking down the app.</li>
      <li><strong>Edit and it re-renders.</strong> Changes recompile after a short pause. Open a real file with the ${gloss('file-system-access', 'File System Access API')} and Reactwell live-watches it while you edit in your own editor.</li>
    </ol>
    <p class="muted">Extra libraries (say <code>lodash</code> or <code>framer-motion</code>) are optional and off by default. When enabled they load from ${gloss('esm-sh', 'esm.sh')} — see the Privacy panel for exactly what that means.</p>
  `;
}

export function privacyHtml(): string {
  return `
    <p>Reactwell is built so your code stays on your device. Here is precisely what is and isn't protected.</p>
    <h3>Protected</h3>
    <ul class="good">
      <li>Your source code is <strong>transpiled entirely in your browser</strong> with ${gloss('esbuild', 'esbuild')} compiled to ${gloss('wasm', 'WebAssembly')}. It is never sent to any server.</li>
      <li>The React runtime is <strong>bundled into the page</strong>, so rendering needs no network at all — the tool works fully offline once loaded.</li>
      <li>Your component runs in a ${gloss('sandbox', 'sandboxed')} ${gloss('iframe', 'iframe')} with a unique origin — it cannot read this app's storage, cookies, or the page around it.</li>
      <li><strong>No accounts, no cookies, no fingerprinting.</strong> Nothing you type is persisted anywhere off your machine.</li>
    </ul>
    <h3>Not protected</h3>
    <ul class="bad">
      <li>If you turn on <strong>“Fetch extra libraries”</strong>, the <em>names</em> of the packages you import are sent to ${gloss('esm-sh', 'esm.sh')} to download them. Your own code is still not sent — only the library requests. Leave it off to stay fully local.</li>
      <li>If you press <strong>Share</strong>, your code is encoded into the link. Anyone you send that link to can read the snippet. The encoding is not encryption.</li>
      <li>Infinite loops in your component run inside the preview frame; they can freeze the preview until you press <strong>reset</strong>.</li>
    </ul>
    <h3>Trust surface</h3>
    <ul class="trust">
      <li>The static site bundle served over TLS by GitHub Pages, and the TLS chain between you and it.</li>
      <li>esm.sh — only if you opt in to fetching extra libraries.</li>
      <li>A Cloudflare Web Analytics beacon records anonymous page views — no cookies, no fingerprinting, no cross-site tracking; your files/data are never sent to it.</li>
      <li>Feedback you choose to send (and an email address, only if you supply one) is sent to feedback.benrichardson.dev. Nothing is sent unless you open the feedback form and press Send; your files and data never are.</li>
    </ul>
  `;
}

export function aboutHtml(): string {
  return `
    <p><strong>Reactwell</strong> renders React components straight from ${gloss('jsx', 'JSX')}/${gloss('tsx', 'TSX')} — the fastest way to see what a component looks like without scaffolding a whole project.</p>
    <p>It's part of a small collection of privacy-first, zero-backend browser tools. Everything runs on your device.</p>
    <ul class="plain">
      <li>By <a href="https://benrichardson.dev/" target="_blank" rel="noopener">benrichardson.dev</a></li>
      <li>Browse the rest → <a href="https://lab.benrichardson.dev" target="_blank" rel="noopener">lab.benrichardson.dev</a></li>
      <li>Source → <a href="https://github.com/ben-gy/reactwell" target="_blank" rel="noopener">github.com/ben-gy/reactwell</a></li>
    </ul>
    <p class="muted">Built with Vite, esbuild-wasm, CodeMirror and React 18. No runtime backend.</p>
  `;
}
