/**
 * Preview surface: owns the sandboxed iframe, turns a successful compile into a
 * runnable document, and renders compile/runtime errors as an overlay. The
 * iframe is recreated on every run so component state never leaks between edits
 * and a hung render can be reset.
 */
import { buildImportMap, buildSrcDoc, parseErrorLine } from './transform';
import { reactUmd, reactDomUmd } from './reactRuntime';
import { emit } from './eventlog';
import { escapeHtml } from './util';
import type { BuildResult, PreviewMessage } from './types';

export interface PreviewOptions {
  allowCdn(): boolean;
  onCdnUsed(specs: string[]): void;
}

export class Preview {
  private host: HTMLElement;
  private overlay: HTMLElement;
  private frame: HTMLIFrameElement | null = null;
  private opts: PreviewOptions;

  constructor(host: HTMLElement, opts: PreviewOptions) {
    this.host = host;
    this.opts = opts;
    this.overlay = document.createElement('div');
    this.overlay.className = 'preview-overlay';
    this.overlay.hidden = true;
    this.host.appendChild(this.overlay);

    window.addEventListener('message', this.onMessage);
  }

  private onMessage = (e: MessageEvent<PreviewMessage>) => {
    const data = e.data;
    if (!data || data.source !== 'reactwell') return;
    if (data.type === 'runtime-error') {
      this.showError(data.title || 'Runtime error', data.detail || '');
      emit('render', 'err', data.title || 'Runtime error');
    } else if (data.type === 'rendered') {
      if (data.note === 'no-default-export') {
        emit('render', 'warn', 'No default export — assuming self-rendered');
      } else {
        emit('render', 'ok', 'Component rendered');
      }
    }
  };

  /** Render a compile result. On success, mounts a fresh iframe. */
  render(result: BuildResult): void {
    if (!result.ok) {
      this.showError('Compile error', result.message, parseErrorLine(result.message));
      emit('compile', 'err', 'Compile failed');
      return;
    }

    const { imports, cdn, blocked } = buildImportMap(result.externals, this.opts.allowCdn());
    if (blocked.length) {
      this.showError(
        'Extra libraries needed',
        `This snippet imports ${blocked.map((b) => `“${b}”`).join(', ')}. ` +
          `Turn on “Fetch extra libraries from esm.sh” to load ${blocked.length > 1 ? 'them' : 'it'}, ` +
          `or remove the import. React itself is always bundled locally.`,
      );
      emit('compile', 'warn', `Blocked ${blocked.length} external import(s)`, { libs: blocked.join(',') });
      return;
    }
    if (cdn.length) this.opts.onCdnUsed(cdn);

    const srcdoc = buildSrcDoc({ bundle: result.code, imports, reactUmd, reactDomUmd });
    this.mount(srcdoc);
    this.hideError();
    emit('compile', 'ok', 'Compiled', { ms: result.durationMs });
  }

  private mount(srcdoc: string): void {
    // Replace the frame outright so old React trees / timers are torn down.
    if (this.frame) this.frame.remove();
    const frame = document.createElement('iframe');
    frame.className = 'preview-frame';
    frame.setAttribute('sandbox', 'allow-scripts allow-modals allow-forms allow-popups');
    frame.setAttribute('title', 'Component preview');
    frame.srcdoc = srcdoc;
    this.host.insertBefore(frame, this.overlay);
    this.frame = frame;
  }

  /** Recreate the iframe from scratch — used by the "reset preview" control. */
  reset(): void {
    if (this.frame) {
      this.frame.remove();
      this.frame = null;
    }
    this.hideError();
    emit('render', 'info', 'Preview reset');
  }

  private showError(title: string, detail: string, line?: number): void {
    const lineHint = line ? ` <span class="err-line">line ${line}</span>` : '';
    this.overlay.innerHTML = `
      <div class="preview-error">
        <div class="err-badge">✕ ${escapeHtml(title)}${lineHint}</div>
        <pre class="err-detail">${escapeHtml(detail.trim() || 'No further detail.')}</pre>
      </div>`;
    this.overlay.hidden = false;
  }

  private hideError(): void {
    this.overlay.hidden = true;
    this.overlay.innerHTML = '';
  }

  dispose(): void {
    window.removeEventListener('message', this.onMessage);
    if (this.frame) this.frame.remove();
  }
}
