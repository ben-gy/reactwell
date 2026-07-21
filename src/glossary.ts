/**
 * Click-to-define glossary. `.glossary-link[data-term]` spans anywhere in the
 * DOM get a click handler that shows a fixed tooltip. Escape / outside-click
 * dismisses it.
 */
export const TERMS: Record<string, string> = {
  jsx: 'A syntax extension that lets you write HTML-like markup inside JavaScript. Browsers do not understand it directly — it must be transpiled to plain function calls first.',
  tsx: 'JSX in a TypeScript file. Same markup, plus type annotations. Reactwell strips the types and transpiles the JSX entirely in your browser.',
  transpile: 'To rewrite source code from one form to an equivalent one — here, turning JSX/TSX into ordinary JavaScript that the browser can run.',
  esbuild: 'An extremely fast JavaScript/TypeScript bundler. Reactwell runs esbuild compiled to WebAssembly, so compilation happens on your machine with no server.',
  wasm: 'WebAssembly — a portable binary format that runs at near-native speed in the browser. The esbuild compiler ships as a .wasm module.',
  bundle: 'Combining your code (and its imports) into a single JavaScript file the browser can load in one go.',
  iframe: 'An embedded browsing context — a page within a page. Reactwell renders your component inside a sandboxed iframe so a crash or infinite loop is contained.',
  sandbox: 'A restricted iframe that runs scripts but is isolated from the parent page — it cannot read the app’s data or storage. Your rendered component lives here.',
  'import-map': 'A small JSON block that tells the browser where to find a module named by a bare specifier like "react". Reactwell points those at local shims.',
  'esm-sh': 'esm.sh — a public CDN that serves npm packages as browser-ready ES modules. Only contacted if you turn on “fetch extra libraries”.',
  'default-export': 'The single main value a module exports with `export default`. Reactwell renders your default-exported component automatically.',
  'file-system-access': 'A browser API that lets a page open a file you pick and re-read it later — used here to live-watch a file you edit in your own editor.',
};

let tooltip: HTMLElement | null = null;

function ensureTooltip(): HTMLElement {
  if (tooltip) return tooltip;
  tooltip = document.createElement('div');
  tooltip.className = 'glossary-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  document.body.appendChild(tooltip);
  return tooltip;
}

function hide(): void {
  if (tooltip) tooltip.classList.remove('show');
}

function show(term: string, x: number, y: number): void {
  const def = TERMS[term];
  if (!def) return;
  const tip = ensureTooltip();
  tip.textContent = def;
  tip.style.left = `${Math.min(x, window.innerWidth - 320)}px`;
  tip.style.top = `${y + 18}px`;
  tip.classList.add('show');
}

/** Wire up delegated glossary handling once. */
export function initGlossary(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest('.glossary-link') as HTMLElement | null;
    if (link && link.dataset.term) {
      e.preventDefault();
      e.stopPropagation();
      const rect = link.getBoundingClientRect();
      show(link.dataset.term, rect.left, rect.bottom);
      return;
    }
    if (tooltip && !target.closest('.glossary-tooltip')) hide();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  });
  window.addEventListener('scroll', hide, true);
}

/** Helper to build a glossary link span (returns HTML string). */
export function gloss(term: string, label?: string): string {
  return `<span class="glossary-link" data-term="${term}" tabindex="0">${label ?? term}</span>`;
}
