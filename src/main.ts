// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/**
 * Bootstraps Reactwell: builds the shell, wires the editor to the esbuild worker
 * and the preview iframe, and hooks up drop/open/share/drawer/modal controls.
 */
import './styles/main.css';
import { buildShell, openModal, closeModal, howItWorksHtml, privacyHtml, aboutHtml } from './ui';
import { createEditor, type EditorHandle } from './editor';
import { BuildClient } from './buildClient';
import { Preview } from './preview';
import { mountEventDrawer, emit } from './eventlog';
import { initGlossary } from './glossary';
import { debounce } from './util';
import { SAMPLES, DEFAULT_SAMPLE } from './samples';
import { readFromUrl, shareUrl } from './router';
import { fsAccessSupported, openAndWatch, readFileText, type WatchHandle } from './fsaccess';
import { mountFeedback } from './feedback';
import type { BuildResult } from './types';

const app = document.getElementById('app')!;
const shell = buildShell(app);

initGlossary();
mountEventDrawer(shell.drawerHost);
mountFeedback();

let allowCdn = false;
let watch: WatchHandle | null = null;

const preview = new Preview(shell.previewHost, {
  allowCdn: () => allowCdn,
  onCdnUsed: (specs) => emit('net', 'warn', 'Fetching from esm.sh', { libs: specs.join(',') }),
});

const builder = new BuildClient();

const setStatus = (text: string, kind: 'ready' | 'busy' | 'ok' | 'err' = 'ready') => {
  shell.statusEl.textContent = text;
  shell.statusEl.dataset.kind = kind;
};

async function compileAndRender(code: string): Promise<void> {
  if (!code.trim()) {
    preview.reset();
    setStatus('empty', 'ready');
    return;
  }
  setStatus('compiling…', 'busy');
  let result: BuildResult;
  try {
    result = await builder.build(code);
  } catch (err) {
    setStatus('worker error', 'err');
    emit('compile', 'err', 'Worker failed', { error: String(err) });
    return;
  }
  if (builder.isStale(result)) return; // a newer edit is already in flight
  preview.render(result);
  if (result.ok) {
    setStatus(`compiled in ${result.durationMs} ms`, 'ok');
  } else {
    setStatus('compile error', 'err');
  }
}

const scheduleCompile = debounce((code: string) => void compileAndRender(code), 350);

// ── Editor ──────────────────────────────────────────────────────────────────

const fromUrl = readFromUrl();
const initialCode = fromUrl ?? DEFAULT_SAMPLE.code;
if (fromUrl) emit('system', 'info', 'Loaded snippet from shared link');

const editor: EditorHandle = createEditor(shell.editorHost, initialCode, (code) => {
  scheduleCompile(code);
});

// First compile immediately (no debounce) once the worker is asked.
emit('system', 'ok', 'Reactwell ready — React 18 bundled locally');
void compileAndRender(initialCode);

// ── File loading (drop + open) ───────────────────────────────────────────────

function loadCode(name: string, code: string): void {
  editor.setCode(code);
  shell.fileBadge.hidden = false;
  shell.fileBadge.textContent = name;
  emit('file', 'ok', 'Loaded file', { name });
  void compileAndRender(code);
}

// Drag & drop anywhere on the workspace.
let dragDepth = 0;
const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');

window.addEventListener('dragenter', (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  dragDepth++;
  shell.dropOverlay.hidden = false;
});
window.addEventListener('dragover', (e) => {
  if (isFileDrag(e)) e.preventDefault();
});
window.addEventListener('dragleave', (e) => {
  if (!isFileDrag(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) shell.dropOverlay.hidden = true;
});
window.addEventListener('drop', async (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  dragDepth = 0;
  shell.dropOverlay.hidden = true;
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  try {
    loadCode(file.name, await readFileText(file));
  } catch (err) {
    emit('file', 'err', 'Could not read dropped file', { error: String(err) });
  }
});

// Open file — prefer File System Access (live-watch), fall back to <input>.
shell.buttons.open.addEventListener('click', async () => {
  if (watch) {
    watch.stop();
    watch = null;
  }
  if (fsAccessSupported()) {
    try {
      watch = await openAndWatch(
        (name, text) => {
          loadCode(name, text);
          emit('file', 'ok', 'Live-watching file', { name });
        },
        (text) => {
          editor.setCode(text);
          emit('file', 'info', 'File changed on disk — reloaded');
          void compileAndRender(text);
        },
      );
    } catch (err) {
      emit('file', 'err', 'Open failed', { error: String(err) });
    }
    return;
  }
  // Fallback: hidden input.
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.jsx,.tsx,.js,.ts,.mjs,text/plain';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (file) loadCode(file.name, await readFileText(file));
  });
  input.click();
});

// ── Samples dropdown ─────────────────────────────────────────────────────────

shell.buttons.samples.addEventListener('click', (e) => {
  e.stopPropagation();
  const existing = document.querySelector('.samples-menu');
  if (existing) {
    existing.remove();
    return;
  }
  const menu = document.createElement('div');
  menu.className = 'samples-menu';
  for (const s of SAMPLES) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'samples-item';
    item.textContent = s.label;
    item.addEventListener('click', () => {
      loadCode(`${s.id}.tsx`, s.code);
      shell.fileBadge.hidden = true; // samples aren't "files"
      menu.remove();
    });
    menu.appendChild(item);
  }
  const rect = shell.buttons.samples.getBoundingClientRect();
  menu.style.left = `${rect.left}px`;
  menu.style.top = `${rect.bottom + 4}px`;
  document.body.appendChild(menu);
  setTimeout(() => {
    const onDoc = () => {
      menu.remove();
      document.removeEventListener('click', onDoc);
    };
    document.addEventListener('click', onDoc);
  }, 0);
});

// ── Share ────────────────────────────────────────────────────────────────────

shell.buttons.share.addEventListener('click', async () => {
  const url = shareUrl(editor.getCode());
  history.replaceState(null, '', url);
  const shareData = { title: 'Reactwell snippet', url };
  try {
    if (navigator.share && navigator.canShare?.(shareData)) {
      await navigator.share(shareData);
      emit('ui', 'ok', 'Shared via system share sheet');
      return;
    }
  } catch {
    /* user cancelled share — fall through to clipboard */
  }
  try {
    await navigator.clipboard.writeText(url);
    setStatus('link copied to clipboard', 'ok');
    emit('ui', 'ok', 'Share link copied', { bytes: url.length });
  } catch {
    setStatus('share link is in the address bar', 'ok');
  }
});

// ── Preview controls ─────────────────────────────────────────────────────────

shell.buttons.reset.addEventListener('click', () => {
  preview.reset();
  void compileAndRender(editor.getCode());
});

shell.cdnToggle.addEventListener('change', () => {
  allowCdn = shell.cdnToggle.checked;
  emit('net', 'info', allowCdn ? 'Extra libraries enabled (esm.sh)' : 'Extra libraries disabled');
  void compileAndRender(editor.getCode());
});

// ── Event drawer toggle ──────────────────────────────────────────────────────

const drawer = shell.drawerHost;
function toggleDrawer(force?: boolean): void {
  const open = force ?? !drawer.classList.contains('open');
  drawer.classList.toggle('open', open);
  drawer.setAttribute('aria-hidden', String(!open));
  shell.buttons.drawerToggle.setAttribute('aria-expanded', String(open));
}
shell.buttons.drawerToggle.addEventListener('click', () => toggleDrawer());
drawer.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('#drawer-close')) toggleDrawer(false);
});

// ── Splitter ─────────────────────────────────────────────────────────────────

(() => {
  const splitter = document.getElementById('splitter')!;
  const workspace = shell.workspace;
  let dragging = false;
  const onMove = (clientX: number) => {
    const rect = workspace.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    const clamped = Math.min(80, Math.max(20, pct));
    workspace.style.setProperty('--editor-width', `${clamped}%`);
  };
  splitter.addEventListener('pointerdown', (e) => {
    dragging = true;
    splitter.setPointerCapture(e.pointerId);
    document.body.classList.add('resizing');
  });
  splitter.addEventListener('pointermove', (e) => {
    if (dragging) onMove(e.clientX);
  });
  splitter.addEventListener('pointerup', (e) => {
    dragging = false;
    splitter.releasePointerCapture(e.pointerId);
    document.body.classList.remove('resizing');
  });
})();

// ── Modals ───────────────────────────────────────────────────────────────────

shell.buttons.how.addEventListener('click', () => openModal('How it works', howItWorksHtml()));
shell.buttons.privacy.addEventListener('click', () => openModal('Privacy &amp; threat model', privacyHtml()));
shell.buttons.about.addEventListener('click', () => openModal('About Reactwell', aboutHtml()));

document.getElementById('trust-more')?.addEventListener('click', () => openModal('Privacy &amp; threat model', privacyHtml()));
document.getElementById('trust-x')?.addEventListener('click', () => {
  document.getElementById('trust-banner')?.remove();
});

// ── Keyboard ─────────────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    if (drawer.classList.contains('open')) toggleDrawer(false);
  }
});

// Cleanup on unload.
window.addEventListener('beforeunload', () => {
  watch?.stop();
  builder.dispose();
  preview.dispose();
});
