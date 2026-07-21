import { describe, expect, it } from 'vitest';
import {
  utf8ToBase64,
  base64ToUtf8,
  jsDataUrl,
  reactImportMap,
  isReactSpecifier,
  buildImportMap,
  buildSrcDoc,
  parseErrorLine,
  REACT_SPECIFIERS,
} from '../src/transform';

describe('base64', () => {
  it('round-trips ASCII', () => {
    const s = 'export default () => <div>hi</div>';
    expect(base64ToUtf8(utf8ToBase64(s))).toBe(s);
  });

  it('round-trips multi-byte unicode', () => {
    const s = 'const emoji = "✓ café — 日本語 🚀";';
    expect(base64ToUtf8(utf8ToBase64(s))).toBe(s);
  });

  it('handles empty string', () => {
    expect(base64ToUtf8(utf8ToBase64(''))).toBe('');
  });

  it('handles a large input past the chunk boundary', () => {
    const s = 'x'.repeat(0x8000 * 2 + 123);
    expect(base64ToUtf8(utf8ToBase64(s))).toBe(s);
  });

  it('jsDataUrl produces a decodable module URL', () => {
    const url = jsDataUrl('export const a = 1;');
    expect(url.startsWith('data:text/javascript;base64,')).toBe(true);
    const payload = url.slice('data:text/javascript;base64,'.length);
    expect(base64ToUtf8(payload)).toBe('export const a = 1;');
  });
});

describe('react specifiers', () => {
  it('recognises the built-in specifiers', () => {
    expect(isReactSpecifier('react')).toBe(true);
    expect(isReactSpecifier('react-dom/client')).toBe(true);
    expect(isReactSpecifier('react/jsx-runtime')).toBe(true);
    expect(isReactSpecifier('lodash')).toBe(false);
  });

  it('reactImportMap maps every specifier to a data: URL', () => {
    const map = reactImportMap();
    for (const spec of REACT_SPECIFIERS) {
      expect(map[spec]).toBeDefined();
      expect(map[spec].startsWith('data:text/javascript;base64,')).toBe(true);
    }
  });

  it('the react shim references the React global', () => {
    const map = reactImportMap();
    const src = base64ToUtf8(map['react'].split('base64,')[1]);
    expect(src).toContain('globalThis.React');
    expect(src).toContain('useState');
  });

  it('the jsx-runtime shim synthesises jsx from createElement', () => {
    const map = reactImportMap();
    const src = base64ToUtf8(map['react/jsx-runtime'].split('base64,')[1]);
    expect(src).toContain('export function jsx');
    expect(src).toContain('createElement');
    expect(src).toContain('export const jsxs');
  });
});

describe('buildImportMap', () => {
  it('returns only react shims when there are no third-party imports', () => {
    const r = buildImportMap(['react', 'react/jsx-runtime'], false);
    expect(r.cdn).toEqual([]);
    expect(r.blocked).toEqual([]);
    expect(Object.keys(r.imports)).toContain('react');
  });

  it('blocks third-party imports when CDN is off', () => {
    const r = buildImportMap(['react', 'lodash', 'framer-motion'], false);
    expect(r.blocked.sort()).toEqual(['framer-motion', 'lodash']);
    expect(r.cdn).toEqual([]);
    expect(r.imports['lodash']).toBeUndefined();
  });

  it('routes third-party imports to esm.sh when CDN is on', () => {
    const r = buildImportMap(['react', 'lodash'], true);
    expect(r.blocked).toEqual([]);
    expect(r.cdn).toEqual(['lodash']);
    expect(r.imports['lodash']).toBe('https://esm.sh/lodash?external=react,react-dom');
  });

  it('never treats react-dom/client as third-party', () => {
    const r = buildImportMap(['react-dom/client'], false);
    expect(r.blocked).toEqual([]);
  });
});

describe('buildSrcDoc', () => {
  const doc = buildSrcDoc({
    bundle: 'export default function A(){return null}',
    imports: { react: 'data:text/javascript;base64,Zm9v' },
    reactUmd: '/*REACT_UMD*/',
    reactDomUmd: '/*REACTDOM_UMD*/',
  });

  it('embeds both UMD runtimes', () => {
    expect(doc).toContain('/*REACT_UMD*/');
    expect(doc).toContain('/*REACTDOM_UMD*/');
  });

  it('includes an import map and a root node', () => {
    expect(doc).toContain('type="importmap"');
    expect(doc).toContain('id="root"');
  });

  it('delivers the bundle as a data: URL import', () => {
    expect(doc).toContain('data:text/javascript;base64,');
    expect(doc).toContain('createRoot');
  });

  it('wires an error channel back to the parent', () => {
    expect(doc).toContain("source: 'reactwell'");
    expect(doc).toContain('runtime-error');
  });
});

describe('parseErrorLine', () => {
  it('extracts a (line:col) location', () => {
    expect(parseErrorLine('Unexpected token (5:12)')).toBe(5);
  });
  it('extracts a "Line N" location', () => {
    expect(parseErrorLine('Error on Line 8: bad')).toBe(8);
  });
  it('returns undefined when no line is present', () => {
    expect(parseErrorLine('some generic failure')).toBeUndefined();
  });
});
