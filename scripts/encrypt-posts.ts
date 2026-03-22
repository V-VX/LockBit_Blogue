/// <reference types="node" />
/**
 * Build-time encryption script.
 *
 * Reads plain Markdown posts from `src/content/posts-src/`,
 * encrypts each post body with AES-256-GCM + PBKDF2-SHA256,
 * and writes encrypted Markdown files to `src/content/posts/`.
 *
 * Each source post must declare its own passphrase via a `key` frontmatter
 * field. The field is stripped from the output so it is never published.
 *
 * Usage:
 *   pnpm encrypt
 *   (runs automatically as a prebuild step via package.json)
 *
 * Requires Node.js 18+ (globalThis.crypto.subtle).
 */

import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import matter from 'gray-matter';
import { encryptBody } from '../src/utils/crypto.js';

const SRC_DIR = new URL('../src/content/posts-src', import.meta.url).pathname;
const OUT_DIR = new URL('../src/content/posts', import.meta.url).pathname;

const fileExists = (path: string): Promise<boolean> =>
  access(path).then(() => true, () => false);

const encryptPost = async (filename: string): Promise<boolean> => {
  const outPath = join(OUT_DIR, filename);

  if (await fileExists(outPath)) {
    console.log(`[skip] ${filename} — already exists`);
    return false;
  }

  const raw = await readFile(join(SRC_DIR, filename), 'utf-8');
  const { data, content } = matter(raw);

  if (!content.trim()) {
    console.warn(`[skip] ${filename} — empty body`);
    return false;
  }

  const postKey = String(data['key'] ?? '').trim();
  if (!postKey) {
    throw new Error(`[error] ${filename} — missing or empty "key" field in frontmatter`);
  }

  const encryptedBody = await encryptBody(content, postKey);

  // Strip "key" from output frontmatter — it must never be published.
  const { key: _omit, ...outputData } = data;

  const outContent = matter.stringify(encryptedBody, {
    ...outputData,
    is_protected: true,
  });

  await writeFile(outPath, outContent, 'utf-8');
  console.log(`[ok]   ${filename}`);
  return true;
};

const run = async (): Promise<void> => {
  const files = (await readdir(SRC_DIR)).filter(
    (f: string) => extname(f) === '.md',
  );

  if (files.length === 0) {
    console.log('No Markdown files found in posts-src/');
    return;
  }

  const results = await Promise.all(files.map((f: string) => encryptPost(f)));
  const encrypted = results.filter(Boolean).length;
  const skipped = files.length - encrypted;
  console.log(`\nDone: ${encrypted} encrypted, ${skipped} skipped → src/content/posts/`);
};

run().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
