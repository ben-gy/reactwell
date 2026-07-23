# Reactwell — Build Review

This file exists only to create a reviewable PR. All code is already deployed on `main`.

**Merge this PR to acknowledge the build.** Closing without merging is also fine.

## Links

- **GitHub Pages:** https://ben-gy.github.io/reactwell/ *(redirects to custom domain once DNS is set)*
- **Custom domain:** https://reactwell.benrichardson.dev *(live after DNS + cert below)*

## What it is

Drop a `.jsx`/`.tsx` file (or paste code) and the React component renders instantly — transpiled by esbuild-wasm in a Web Worker, mounted in a sandboxed iframe. React 18 is bundled locally, so it works fully offline with zero backend. Your code never leaves the device.

## DNS setup required

Add in Cloudflare (`benrichardson.dev` zone):

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `reactwell` | `ben-gy.github.io` | DNS only (grey cloud) |

*(Already created by the build pipeline — listed here for the record.)*

Then trigger cert issuance:
```bash
gh api repos/ben-gy/reactwell/pages -X PUT -f cname=""
sleep 3
gh api repos/ben-gy/reactwell/pages -X PUT -f cname="reactwell.benrichardson.dev"
```
