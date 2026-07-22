// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/**
 * Share-by-URL: the current snippet is encoded into the location hash so a link
 * reproduces the exact code. Encoding is UTF-8 → base64url (no server, no
 * shortener). The code never leaves the device unless the user copies the link.
 */
import { utf8ToBase64, base64ToUtf8 } from './transform';

const PREFIX = '#code=';

function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(u: string): string {
  let s = u.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return s;
}

/** Encode code into a shareable hash fragment (including the leading `#`). */
export function encodeHash(code: string): string {
  return PREFIX + toBase64Url(utf8ToBase64(code));
}

/** Decode code from a hash fragment, or null if none/invalid. */
export function decodeHash(hash: string): string | null {
  if (!hash || !hash.startsWith(PREFIX)) return null;
  const payload = hash.slice(PREFIX.length);
  if (!payload) return null;
  try {
    return base64ToUtf8(fromBase64Url(payload));
  } catch {
    return null;
  }
}

/** Read the snippet from the current URL, if any. */
export function readFromUrl(): string | null {
  return decodeHash(location.hash);
}

/** Build a full absolute share URL for the given code. */
export function shareUrl(code: string): string {
  return `${location.origin}${location.pathname}${encodeHash(code)}`;
}
