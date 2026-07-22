/// <reference lib="webworker" />
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/**
 * Dedicated worker that owns the esbuild-wasm compiler. All JSX/TSX transpiling
 * and bundling happens here so the main thread stays responsive even while the
 * user types. esbuild is initialised with `worker: false` because we are already
 * inside a worker — no nested worker needed.
 */
import * as esbuild from 'esbuild-wasm';
// Vite copies the wasm binary next to the bundle and hands us a same-origin URL.
import wasmURL from 'esbuild-wasm/esbuild.wasm?url';
import type { BuildRequest, BuildResult } from '../types';

/**
 * Marks every non-relative import as external so the browser (which has no
 * filesystem) never attempts a node_modules lookup. Relative/absolute imports
 * are left alone — a single-file scratchpad has none, and if one is present
 * esbuild will surface a clear "Could not resolve" error.
 */
const externalizeBareImports: esbuild.Plugin = {
  name: 'externalize-bare-imports',
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === 'entry-point') return null;
      if (args.path.startsWith('.') || args.path.startsWith('/')) return null;
      return { path: args.path, external: true };
    });
  },
};

let ready: Promise<void> | null = null;

function ensureReady(): Promise<void> {
  if (!ready) {
    ready = esbuild.initialize({ wasmURL, worker: false });
  }
  return ready;
}

async function compile(req: BuildRequest): Promise<BuildResult> {
  const started = performance.now();
  try {
    await ensureReady();
    const result = await esbuild.build({
      stdin: {
        contents: req.code,
        loader: 'tsx',
        sourcefile: 'scratchpad.tsx',
      },
      bundle: true,
      write: false,
      format: 'esm',
      target: 'es2020',
      jsx: 'automatic',
      jsxImportSource: 'react',
      jsxDev: false,
      // Externalise every bare import so esbuild never touches a filesystem that
      // doesn't exist in the browser. The iframe import map resolves them at
      // runtime. This also covers the auto-injected `react/jsx-runtime` import,
      // which `packages: 'external'` alone fails to catch in the wasm build.
      plugins: [externalizeBareImports],
      metafile: true,
      logLevel: 'silent',
      define: { 'process.env.NODE_ENV': '"production"' },
    });

    const out = result.outputFiles?.[0]?.text ?? '';
    const externals = collectExternals(result.metafile);
    return {
      id: req.id,
      ok: true,
      code: out,
      externals,
      durationMs: Math.round(performance.now() - started),
    };
  } catch (err) {
    return {
      id: req.id,
      ok: false,
      message: formatBuildError(err),
    };
  }
}

/** Pull external bare-import specifiers out of the esbuild metafile. */
function collectExternals(metafile: esbuild.Metafile | undefined): string[] {
  if (!metafile) return [];
  const set = new Set<string>();
  for (const input of Object.values(metafile.inputs)) {
    for (const imp of input.imports) {
      if (imp.external && !imp.path.startsWith('.') && !imp.path.startsWith('/')) {
        set.add(imp.path);
      }
    }
  }
  return [...set];
}

function formatBuildError(err: unknown): string {
  // esbuild throws an object with an `errors` array of structured messages.
  const anyErr = err as { errors?: Array<{ text: string; location?: { line: number; column: number } | null }> };
  if (anyErr && Array.isArray(anyErr.errors) && anyErr.errors.length) {
    return anyErr.errors
      .map((e) => {
        const loc = e.location ? ` (${e.location.line}:${e.location.column})` : '';
        return `${e.text}${loc}`;
      })
      .join('\n');
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

self.onmessage = async (e: MessageEvent<BuildRequest>) => {
  const result = await compile(e.data);
  (self as unknown as Worker).postMessage(result);
};
