// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/**
 * The React & ReactDOM UMD builds, inlined as text at OUR build time. They ship
 * with the app bundle, so the preview works fully offline with no CDN. These are
 * classic scripts that assign `window.React` / `window.ReactDOM` inside the
 * sandboxed iframe. Pinned to React 18.x, whose UMD builds still exist (React 19
 * dropped them).
 */
import reactUmd from './vendor/react.production.min.js?raw';
import reactDomUmd from './vendor/react-dom.production.min.js?raw';

export { reactUmd, reactDomUmd };
