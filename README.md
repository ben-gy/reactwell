# reactwell

**Drop a JSX or TSX file and see the React component render instantly — transpiled in your browser, nothing uploaded.**

Live: https://reactwell.benrichardson.dev

---

## what it is

Reactwell is a scratchpad for React components. Paste or drop a `.jsx`/`.tsx` file and it renders — no `npm install`, no Vite project to scaffold, no dev server to start. It's the fastest way to answer *"what does this component actually look like?"* without setting up a whole project.

Everything happens on your machine. Your JSX is transpiled by [esbuild](https://esbuild.github.io/) compiled to WebAssembly, running in a background worker so typing stays smooth. React itself is bundled into the page, so once the tab has loaded the tool works fully offline — no CDN, no accounts, no server round-trips. Your code is never sent anywhere.

It's for developers who want a quick look at a component, reviewers checking a snippet from a PR, people learning React, and anyone who's ever thought "I just want to run this one file."

## how it works

```
 ┌── you type / drop JSX ──┐
 │  CodeMirror editor      │
 └───────────┬─────────────┘
             │ debounced 350ms
             ▼
 ┌── esbuild-wasm worker ──┐   packages left external
 │  tsx → esm, JSX auto    │   (react, react/jsx-runtime, …)
 └───────────┬─────────────┘
             │ bundle text + externals
             ▼
 ┌── build the srcdoc ─────┐
 │  React/ReactDOM UMD      │   inlined as text
 │  + import map (data:)    │   react → shim → window.React
 │  + your bundle (data:)   │
 └───────────┬─────────────┘
             ▼
 ┌── sandboxed iframe ─────┐
 │  allow-scripts only     │   opaque origin, isolated
 │  mounts default export  │   error boundary → overlay
 └─────────────────────────┘
```

The preview iframe runs with `sandbox="allow-scripts"` and **no** `allow-same-origin`, so it gets a unique opaque origin and cannot touch the app around it. Because an opaque-origin frame can't read the parent's Blob URLs, everything it needs is inlined as text and every module specifier resolves through an **import map** whose targets are `data:` URLs.

`import … from 'react'` resolves to a tiny shim module that re-exports `window.React`, which the bundled React UMD build assigns. The automatic JSX runtime (`react/jsx-runtime`) is synthesised from `React.createElement`. So ordinary React code Just Works, fully offline.

Extra libraries (e.g. `lodash`, `framer-motion`) are **off by default**. When you enable them, only the library *names* are sent to [esm.sh](https://esm.sh) to fetch them — your own code still never leaves the device.

## browser APIs used

- **WebAssembly** — esbuild's compiler ships as a `.wasm` module and transpiles JSX/TypeScript on-device.
- **Web Workers** — all compilation runs in a dedicated worker; the UI never blocks.
- **Import maps + `data:` URL modules** — wire bare specifiers to local React shims inside the sandbox.
- **Sandboxed `<iframe>` (`srcdoc`)** — isolates the rendered component; a crash or thrown error is caught, not fatal.
- **`postMessage`** — the frame streams render/runtime errors back to the app.
- **File System Access API** — open a real file and live-watch it, so edits in your own editor reflect instantly (with a hidden-`<input>` fallback).
- **Clipboard + Web Share API** — copy or share a link that encodes the snippet.
- **Service Worker (PWA)** — precaches the app shell; the 12 MB esbuild wasm is runtime-cached on first use, then works offline.

## security / privacy model

**Protected**
- Source code is transpiled entirely in-browser (esbuild-wasm) and never sent to a server.
- React is bundled into the page; rendering needs no network.
- Your component runs in a sandboxed, opaque-origin iframe — it cannot read the app's storage or cookies.
- No accounts, no cookies, no fingerprinting.

**Not protected**
- With "Fetch extra libraries" on, the *names* of imported packages are sent to esm.sh (not your code).
- The Share link encodes your code (base64url, not encryption) — anyone with the link can read the snippet.
- Infinite loops in your component run in the preview frame and can freeze it until you press **reset**.

**Trust model**
- The static site bundle served over TLS by GitHub Pages, and the TLS chain to it.
- esm.sh — only if you opt in to extra libraries.
- Cloudflare Web Analytics — anonymous, cookie-less page-view counts; never receives your code.
- feedback.benrichardson.dev — only if you open the feedback form and press Send.

## stack

- Vite 6 + vanilla TypeScript
- esbuild-wasm (in-browser transpile/bundle)
- CodeMirror 6 (`@codemirror/lang-javascript` with JSX + TypeScript)
- React 18 UMD (vendored, for the preview runtime)
- vite-plugin-pwa (offline shell)
- Vitest for unit tests
- GitHub Pages for hosting, deployed via GitHub Actions

No runtime backend. No cookies, no fingerprinting, no third-party fonts. Anonymous, cookie-less page-view counts via Cloudflare Web Analytics — no personal data, no cross-site tracking.

## local development

```bash
npm install
npm run dev      # vite dev server on :5173
npm test         # run vitest suite
npm run build    # produce dist/ for deploy
npm run preview  # serve dist/ locally
```

## deploying

A push to `main` triggers `.github/workflows/deploy.yml`, which runs tests, builds, and deploys `dist/` to GitHub Pages. The custom domain is set via `public/CNAME` — point a `CNAME` DNS record for `reactwell.benrichardson.dev` at `ben-gy.github.io`.

## license

[GNU Affero General Public License v3.0 or later](./LICENSE), with an attribution
requirement added under section 7(b) — see
[ADDITIONAL-TERMS.md](./ADDITIONAL-TERMS.md).

In short: you may run, modify, redistribute and even sell this, but if you
distribute it — or run a modified version where other people can reach it — you
have to publish your source under the same licence and keep the attribution. A
separate commercial licence without those obligations is available on request:
<hi@ben.gy>.

Third-party components keep their own licences — see
[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
