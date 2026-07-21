import { describe, expect, it, beforeEach, vi } from 'vitest';
import { encodeHash, decodeHash, shareUrl } from '../src/router';

describe('router hash encoding', () => {
  it('round-trips a snippet', () => {
    const code = 'export default () => <h1>Hello</h1>;';
    expect(decodeHash(encodeHash(code))).toBe(code);
  });

  it('round-trips unicode', () => {
    const code = 'const s = "café ✓ 日本語";';
    expect(decodeHash(encodeHash(code))).toBe(code);
  });

  it('produces URL-safe base64 (no + / =)', () => {
    // Inputs chosen to force + and / in standard base64.
    const code = '???>>><<<ÿþý';
    const hash = encodeHash(code);
    const payload = hash.replace('#code=', '');
    expect(payload).not.toMatch(/[+/=]/);
    expect(decodeHash(hash)).toBe(code);
  });

  it('returns null for an unrelated hash', () => {
    expect(decodeHash('#section-2')).toBeNull();
    expect(decodeHash('')).toBeNull();
    expect(decodeHash('#code=')).toBeNull();
  });

  it('returns null for malformed payloads instead of throwing', () => {
    expect(decodeHash('#code=@@@not-base64@@@')).toBeNull();
  });
});

describe('shareUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('location', {
      origin: 'https://reactwell.benrichardson.dev',
      pathname: '/',
      hash: '',
    } as unknown as Location);
  });

  it('builds an absolute URL that decodes back to the code', () => {
    const code = 'export default () => null;';
    const url = shareUrl(code);
    expect(url.startsWith('https://reactwell.benrichardson.dev/#code=')).toBe(true);
    expect(decodeHash(url.slice(url.indexOf('#')))).toBe(code);
  });
});
