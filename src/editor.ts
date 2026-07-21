/** CodeMirror 6 editor wired for JSX/TSX with a dark theme. */
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  foldGutter,
} from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';

export interface EditorHandle {
  view: EditorView;
  getCode(): string;
  setCode(code: string): void;
  focus(): void;
  destroy(): void;
}

export function createEditor(
  parent: HTMLElement,
  initial: string,
  onChange: (code: string) => void,
): EditorHandle {
  const listener = EditorView.updateListener.of((u) => {
    if (u.docChanged) onChange(u.state.doc.toString());
  });

  const extensions: Extension[] = [
    lineNumbers(),
    foldGutter(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    history(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    javascript({ jsx: true, typescript: true }),
    oneDark,
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
    listener,
    EditorView.theme({
      '&': { height: '100%', fontSize: '13px' },
      '.cm-scroller': { fontFamily: "'SF Mono','Fira Code','Cascadia Code',Consolas,monospace", overflow: 'auto' },
      '.cm-content': { paddingBottom: '40vh' },
    }),
  ];

  const view = new EditorView({
    state: EditorState.create({ doc: initial, extensions }),
    parent,
  });

  return {
    view,
    getCode: () => view.state.doc.toString(),
    setCode: (code: string) => {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
