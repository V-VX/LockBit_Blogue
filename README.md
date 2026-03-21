# LockBit Blogue

An Astro 4 static blog with client-side encrypted content. Posts are encrypted at build time and decrypted in the browser using a passphrase passed via URL query parameter.

## How it works

1. Plain Markdown posts live in `src/content/posts-src/` (not committed)
2. `pnpm encrypt` encrypts each post body with **AES-256-GCM + PBKDF2-SHA256** and writes the result to `src/content/posts/`
3. Only encrypted posts are deployed
4. Readers access posts via `?key=<passphrase>` — the browser decrypts and renders the content client-side

Encryption uses `globalThis.crypto.subtle` (Web Crypto API) on both sides, guaranteeing identical behaviour in Node.js 18+ and modern browsers.

## Commands

| Command | Action |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start dev server at `localhost:4321` |
| `pnpm encrypt` | Encrypt posts from `posts-src/` → `posts/` |
| `pnpm build` | Encrypt + type-check + build to `./dist/` |
| `pnpm preview` | Preview production build locally |

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Set your encryption passphrase
echo "ENCRYPT_KEY=your-passphrase" > .env

# 3. Add plain posts to src/content/posts-src/
# 4. Build
pnpm build
```

## Accessing encrypted posts

Append `?key=<passphrase>` to any post URL:

```
https://yoursite.com/posts/my-post?key=your-passphrase
```

## Tech stack

- [Astro 4](https://astro.build) — static site framework
- [React 18](https://react.dev) — client-side interactivity
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — AES-256-GCM encryption
- [marked](https://marked.js.org) — client-side Markdown rendering
- [DOMPurify](https://github.com/cure53/DOMPurify) — XSS sanitisation
- TypeScript 5 (strict)
