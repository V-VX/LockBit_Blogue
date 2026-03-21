/// <reference types="node" />
/**
 * Build-time encryption script.
 *
 * Reads plain Markdown posts from `src/content/posts-src/`,
 * encrypts each post body with AES-256-GCM + PBKDF2-SHA256,
 * and writes encrypted Markdown files to `src/content/posts/`.
 *
 * The frontmatter is preserved as-is with `is_protected: true` added.
 * The encrypted body (base64) replaces the original body.
 *
 * Usage:
 *   ENCRYPT_KEY=<passphrase> pnpm encrypt
 *   (runs automatically as a prebuild step via package.json)
 *
 * Requires Node.js 18+ (globalThis.crypto.subtle).
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import matter from 'gray-matter';
import { encryptBody } from '../src/utils/crypto.js';

const SRC_DIR = new URL('../src/content/posts-src', import.meta.url).pathname;
const OUT_DIR = new URL('../src/content/posts', import.meta.url).pathname;

const getPassphrase = (): string => {
  const key = process.env['ENCRYPT_KEY'];
  if (!key) {
    throw new Error(
      'ENCRYPT_KEY environment variable is not set.\n' +
      'Set it in your .env file or export it before running this script.',
    );
  }
  return key;
};

const encryptPost = async (
  filename: string,
  passphrase: string,
): Promise<void> => {
  const raw = await readFile(join(SRC_DIR, filename), 'utf-8');
  const { data, content } = matter(raw);

  if (!content.trim()) {
    console.warn(`[skip] ${filename} — empty body`);
    return;
  }

  const encryptedBody = await encryptBody(content, passphrase);

  const outContent = matter.stringify(encryptedBody, {
    ...data,
    is_protected: true,
  });

  await writeFile(join(OUT_DIR, filename), outContent, 'utf-8');
  console.log(`[ok]   ${filename}`);
};

const run = async (): Promise<void> => {
  const passphrase = getPassphrase();

  const files = (await readdir(SRC_DIR)).filter(
    (f: string) => extname(f) === '.md',
  );

  if (files.length === 0) {
    console.log('No Markdown files found in posts-src/');
    return;
  }

  await Promise.all(files.map((f: string) => encryptPost(f, passphrase)));
  console.log(`\nEncrypted ${files.length} post(s) → src/content/posts/`);
};

run().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
