/// <reference types="node" />
/**
 * Build-time encryption script.
 *
 * Reads plain Markdown posts from `src/content/posts-src/`,
 * encrypts each post body with AES-256-GCM + PBKDF2-SHA256,
 * and writes encrypted Markdown files to `src/content/posts/`.
 *
 * Each source post must declare its own passphrase via a `key` frontmatter
 * field. For multi-key posts, `key` is the inner content key and
 * `access_keys` contains community-specific wrapper keys. Plaintext keys are
 * always stripped from the published output.
 *
 * Usage:
 *   pnpm encrypt
 *   (runs automatically as a prebuild step via package.json)
 *
 * Requires Node.js 18+ (globalThis.crypto.subtle).
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import matter from 'gray-matter';
import { encrypt, encryptBody } from '../src/utils/crypto.js';

const SRC_DIR = new URL('../src/content/posts-src', import.meta.url).pathname;
const OUT_DIR = new URL('../src/content/posts', import.meta.url).pathname;

type AccessKeys = Record<string, string>;

const normalizeAccessKeys = (
  value: unknown,
  filename: string,
): AccessKeys | null => {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[error] ${filename} — "access_keys" must be an object map`);
  }

  const normalized = Object.entries(value).reduce<AccessKeys>((acc, [kid, rawSecret]) => {
    const normalizedKid = kid.trim();
    const secret = String(rawSecret ?? '').trim();

    if (!normalizedKid) {
      throw new Error(`[error] ${filename} — "access_keys" contains an empty community id`);
    }
    if (!secret) {
      throw new Error(`[error] ${filename} — "access_keys.${normalizedKid}" is missing or empty`);
    }

    acc[normalizedKid] = secret;
    return acc;
  }, {});

  if (Object.keys(normalized).length === 0) {
    throw new Error(`[error] ${filename} — "access_keys" must include at least one community key`);
  }

  return normalized;
};

const encryptPost = async (filename: string): Promise<boolean> => {
  const outPath = join(OUT_DIR, filename);
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

  const accessKeys = normalizeAccessKeys(data['access_keys'], filename);
  const encryptedBody = await encryptBody(content, postKey);
  const accessEnvelopes = accessKeys
    ? Object.fromEntries(
      await Promise.all(
        Object.entries(accessKeys)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(async ([kid, secret]) => [kid, await encrypt(postKey, secret)]),
      ),
    )
    : undefined;

  // Strip plaintext keys from output frontmatter — they must never be published.
  const { key: _omit, access_keys: _omitAccessKeys, ...outputData } = data;

  const outContent = matter.stringify(encryptedBody, {
    ...outputData,
    ...(accessEnvelopes ? { access_envelopes: accessEnvelopes } : {}),
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
