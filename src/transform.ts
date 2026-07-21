/**
 * Pure helpers that turn a compiled ESM bundle into a self-contained,
 * sandbox-ready HTML document for the preview iframe.
 *
 * Design notes
 * ------------
 * The preview iframe runs with `sandbox="allow-scripts"` and NO
 * `allow-same-origin`, so it gets a unique opaque origin. That means it cannot
 * read Blob URLs minted by the parent. Everything the iframe needs is therefore
 * inlined as text, and module specifiers resolve through an import map whose
 * targets are `data:` URLs — which are origin-independent.
 *
 * React itself is provided as its UMD build (a classic script that assigns
 * `window.React` / `window.ReactDOM`). The bare specifiers `react`,
 * `react-dom`, `react-dom/client` and `react/jsx-runtime` map to tiny `data:`
 * shim modules that re-export those globals, so ordinary `import` statements in
 * user code Just Work — fully offline, no CDN, no network.
 */

/** Bare specifiers we satisfy locally from the bundled React UMD globals. */
export const REACT_SPECIFIERS = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
];

/** UTF-8-safe base64 (btoa only handles latin1). */
export function utf8ToBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Inverse of {@link utf8ToBase64}. */
export function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Wrap JS source into a base64 `data:` URL usable as an ES module. */
export function jsDataUrl(source: string): string {
  return `data:text/javascript;base64,${utf8ToBase64(source)}`;
}

// ── React global shims (ES modules that read the UMD globals) ────────────────

const REACT_SHIM = `const R = globalThis.React;
if (!R) throw new Error('React runtime was not loaded');
export default R;
export const version = R.version;
export const createElement = R.createElement, cloneElement = R.cloneElement,
  createContext = R.createContext, createFactory = R.createFactory,
  createRef = R.createRef, forwardRef = R.forwardRef, isValidElement = R.isValidElement,
  lazy = R.lazy, memo = R.memo, startTransition = R.startTransition,
  Children = R.Children, Component = R.Component, Fragment = R.Fragment,
  Profiler = R.Profiler, PureComponent = R.PureComponent, StrictMode = R.StrictMode,
  Suspense = R.Suspense,
  useCallback = R.useCallback, useContext = R.useContext, useDebugValue = R.useDebugValue,
  useDeferredValue = R.useDeferredValue, useEffect = R.useEffect, useId = R.useId,
  useImperativeHandle = R.useImperativeHandle, useInsertionEffect = R.useInsertionEffect,
  useLayoutEffect = R.useLayoutEffect, useMemo = R.useMemo, useReducer = R.useReducer,
  useRef = R.useRef, useState = R.useState, useSyncExternalStore = R.useSyncExternalStore,
  useTransition = R.useTransition;`;

const REACT_DOM_SHIM = `const RD = globalThis.ReactDOM;
if (!RD) throw new Error('ReactDOM runtime was not loaded');
export default RD;
export const createPortal = RD.createPortal, flushSync = RD.flushSync,
  createRoot = RD.createRoot, hydrateRoot = RD.hydrateRoot,
  findDOMNode = RD.findDOMNode, render = RD.render,
  unmountComponentAtNode = RD.unmountComponentAtNode, version = RD.version;`;

const REACT_DOM_CLIENT_SHIM = `const RD = globalThis.ReactDOM;
if (!RD) throw new Error('ReactDOM runtime was not loaded');
export const createRoot = RD.createRoot, hydrateRoot = RD.hydrateRoot;
export default { createRoot: RD.createRoot, hydrateRoot: RD.hydrateRoot };`;

// The automatic JSX runtime. React 18's UMD does not expose jsx/jsxs, so we
// synthesise them from createElement — a faithful equivalent for rendering.
const JSX_RUNTIME_SHIM = `const R = globalThis.React;
if (!R) throw new Error('React runtime was not loaded');
export const Fragment = R.Fragment;
export function jsx(type, props, key) {
  props = props || {};
  const { children, ...rest } = props;
  if (key !== undefined) rest.key = key;
  const kids = children === undefined ? []
    : Array.isArray(children) ? children : [children];
  return R.createElement(type, rest, ...kids);
}
export const jsxs = jsx;
export const jsxDEV = jsx;`;

/** Map every React specifier to its shim `data:` URL. */
export function reactImportMap(): Record<string, string> {
  return {
    react: jsDataUrl(REACT_SHIM),
    'react-dom': jsDataUrl(REACT_DOM_SHIM),
    'react-dom/client': jsDataUrl(REACT_DOM_CLIENT_SHIM),
    'react/jsx-runtime': jsDataUrl(JSX_RUNTIME_SHIM),
    'react/jsx-dev-runtime': jsDataUrl(JSX_RUNTIME_SHIM),
  };
}

/** True for the built-in React specifiers we resolve locally. */
export function isReactSpecifier(spec: string): boolean {
  return REACT_SPECIFIERS.includes(spec);
}

export interface ImportMapResult {
  /** The full import map { specifier -> url }. */
  imports: Record<string, string>;
  /** Third-party specifiers routed to esm.sh (empty unless allowCdn). */
  cdn: string[];
  /** Third-party specifiers blocked because CDN fetching is disabled. */
  blocked: string[];
}

/**
 * Build the iframe import map. React specifiers resolve to local shims.
 * Anything else is a third-party library: routed to esm.sh when {@link allowCdn}
 * is on (pinned to our React via `?external`), otherwise reported as blocked.
 */
export function buildImportMap(externals: string[], allowCdn: boolean): ImportMapResult {
  const imports = reactImportMap();
  const cdn: string[] = [];
  const blocked: string[] = [];
  for (const spec of externals) {
    if (isReactSpecifier(spec)) continue;
    if (allowCdn) {
      imports[spec] = `https://esm.sh/${spec}?external=react,react-dom`;
      cdn.push(spec);
    } else {
      blocked.push(spec);
    }
  }
  return { imports, cdn, blocked };
}

export interface SrcDocInput {
  /** Compiled ESM bundle text (external imports intact). */
  bundle: string;
  /** { specifier -> url } import map. */
  imports: Record<string, string>;
  /** React UMD source (assigns window.React). */
  reactUmd: string;
  /** ReactDOM UMD source (assigns window.ReactDOM). */
  reactDomUmd: string;
}

/**
 * Assemble the complete HTML document loaded into the sandboxed preview iframe.
 * The bundle is delivered as a `data:` URL module and dynamically imported by a
 * small runner that mounts the default export (or lets user code self-mount).
 */
export function buildSrcDoc({ bundle, imports, reactUmd, reactDomUmd }: SrcDocInput): string {
  const bundleUrl = jsDataUrl(bundle);
  const importMapJson = JSON.stringify({ imports });
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  /* Force a predictable light canvas so components with no colour of their own
     stay legible — otherwise a dark OS theme paints default text white on the
     white preview and it vanishes. */
  :root { color-scheme: light; }
  html, body { margin: 0; background: #ffffff; color: #111111; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 16px; line-height: 1.5; }
  #root:empty::after { content: 'Component mounted but rendered nothing.'; color: #888; font-style: italic; }
</style>
</head>
<body>
<script>${reactUmd}</script>
<script>${reactDomUmd}</script>
<script type="importmap">${importMapJson}</script>
<div id="root"></div>
<script type="module">
  const post = (m) => { try { parent.postMessage(Object.assign({ source: 'reactwell' }, m), '*'); } catch (_) {} };
  const fail = (title, detail) => post({ type: 'runtime-error', title, detail: String(detail || '') });
  window.addEventListener('error', (e) => {
    fail(e.message || 'Runtime error', (e.error && e.error.stack) || e.message || '');
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    fail('Unhandled promise rejection', (r && (r.stack || r.message)) || String(r));
  });
  function makeBoundary(React) {
    class Boundary extends React.Component {
      constructor(p) { super(p); this.state = { err: null }; }
      static getDerivedStateFromError(err) { return { err }; }
      componentDidCatch(err) { fail('React render error', (err && (err.stack || err.message)) || String(err)); }
      render() { return this.state.err ? null : this.props.children; }
    }
    return Boundary;
  }
  (async () => {
    try {
      const React = window.React, ReactDOM = window.ReactDOM;
      const mod = await import(${JSON.stringify(bundleUrl)});
      const App = mod.default;
      const root = document.getElementById('root');
      if (App === undefined) {
        post({ type: 'rendered', note: 'no-default-export' });
        return;
      }
      const element = (typeof App === 'function') ? React.createElement(App)
        : (App && App.$$typeof) ? App : null;
      if (!element) {
        fail('Invalid default export', 'export default must be a React component or element.');
        return;
      }
      const Boundary = makeBoundary(React);
      ReactDOM.createRoot(root).render(React.createElement(Boundary, null, element));
      post({ type: 'rendered' });
    } catch (err) {
      fail('Preview failed to start', (err && (err.stack || err.message)) || String(err));
    }
  })();
</script>
</body>
</html>`;
}

/**
 * Pull a best-effort 1-based line number out of an esbuild error string like
 * `... (5:12)` or `Line 5:`.
 */
export function parseErrorLine(message: string): number | undefined {
  const paren = message.match(/\((\d+):\d+\)/);
  if (paren) return Number(paren[1]);
  const word = message.match(/[Ll]ine\s+(\d+)/);
  if (word) return Number(word[1]);
  return undefined;
}
