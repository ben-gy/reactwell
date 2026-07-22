// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/**
 * Thin RPC wrapper around the esbuild worker. Serialises build requests,
 * matches responses by id, and cancels stale compiles (only the newest request
 * matters when the user is typing quickly).
 */
import type { BuildRequest, BuildResult } from './types';

export class BuildClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, (r: BuildResult) => void>();
  private latest = 0;

  constructor() {
    this.worker = new Worker(new URL('./workers/build.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (e: MessageEvent<BuildResult>) => {
      const resolve = this.pending.get(e.data.id);
      if (resolve) {
        this.pending.delete(e.data.id);
        resolve(e.data);
      }
    };
  }

  /**
   * Compile source. Resolves with a {@link BuildResult}. If a newer build has
   * been requested by the time this one returns, the result is flagged stale via
   * {@link isStale} so the caller can ignore it.
   */
  build(code: string): Promise<BuildResult> {
    const id = this.nextId++;
    this.latest = id;
    const req: BuildRequest = { id, code };
    return new Promise<BuildResult>((resolve) => {
      this.pending.set(id, resolve);
      this.worker.postMessage(req);
    });
  }

  /** Whether the given result has been superseded by a later build request. */
  isStale(result: BuildResult): boolean {
    return result.id !== this.latest;
  }

  dispose(): void {
    this.worker.terminate();
    this.pending.clear();
  }
}
