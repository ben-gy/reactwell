/**
 * File System Access integration: open a real file on disk, then poll it so
 * edits made in the user's own editor flow back into Reactwell automatically.
 * The file is only ever read — never written — and only after the user picks it
 * through the browser's own file dialog.
 */

export interface WatchHandle {
  name: string;
  stop(): void;
}

interface FsWindow {
  showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle[]>;
}

/** True when the browser supports opening + re-reading a picked file. */
export function fsAccessSupported(): boolean {
  return typeof (window as unknown as FsWindow).showOpenFilePicker === 'function';
}

/**
 * Prompt for a .jsx/.tsx/.js/.ts file, deliver its initial contents, and poll
 * for external changes. `onExternalChange` fires only when the file's
 * `lastModified` advances. Returns a handle to stop watching (or null if the
 * user cancelled / the API is unavailable).
 */
export async function openAndWatch(
  onInitial: (name: string, text: string) => void,
  onExternalChange: (text: string) => void,
  pollMs = 1000,
): Promise<WatchHandle | null> {
  const picker = (window as unknown as FsWindow).showOpenFilePicker;
  if (!picker) return null;

  let handles: FileSystemFileHandle[];
  try {
    handles = await picker({
      types: [
        {
          description: 'JSX / TSX / JS / TS',
          accept: { 'text/plain': ['.jsx', '.tsx', '.js', '.ts', '.mjs'] },
        },
      ],
      multiple: false,
    });
  } catch {
    // User dismissed the picker.
    return null;
  }

  const handle = handles[0];
  if (!handle) return null;

  const first = await handle.getFile();
  let lastModified = first.lastModified;
  onInitial(handle.name, await first.text());

  const timer = window.setInterval(async () => {
    try {
      const file = await handle.getFile();
      if (file.lastModified !== lastModified) {
        lastModified = file.lastModified;
        onExternalChange(await file.text());
      }
    } catch {
      // Permission may lapse or the file may be removed — stop quietly.
      window.clearInterval(timer);
    }
  }, pollMs);

  return {
    name: handle.name,
    stop: () => window.clearInterval(timer),
  };
}

/** Read a plain dropped/picked File as text. */
export function readFileText(file: File): Promise<string> {
  return file.text();
}
