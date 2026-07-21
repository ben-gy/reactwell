/** Shared type contracts across the app + build worker. */

export interface BuildRequest {
  id: number;
  code: string;
}

export interface BuildOk {
  id: number;
  ok: true;
  /** ESM bundle text — external bare imports (react, cdn libs) left in place. */
  code: string;
  /** Bare, non-relative import specifiers the bundle expects at runtime. */
  externals: string[];
  /** Milliseconds the compile took. */
  durationMs: number;
}

export interface BuildErr {
  id: number;
  ok: false;
  /** Human-readable compile error message(s). */
  message: string;
  /** Best-effort 1-based line number in the source, if known. */
  line?: number;
}

export type BuildResult = BuildOk | BuildErr;

/** Messages the preview iframe posts back to the app. */
export interface PreviewMessage {
  source: 'reactwell';
  type: 'rendered' | 'runtime-error' | 'log';
  title?: string;
  detail?: string;
  note?: string;
}
