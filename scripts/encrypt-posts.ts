/// <reference types="node" />
/**
 * Build-time encryption script.
 *
 * Reads plain Markdown posts from `src/content/posts-src/`,
 * encrypts each post body with AES-256-GCM + PBKDF2-SHA256,
 * and writes encrypted Markdown files to `src/content/posts/`.
 *
 * Output filenames are also deterministic:
 * each source filename stem is converted into a keyed HMAC-SHA-256 digest
 * using that post's `key`, truncated to 128 bits, and emitted as a compact
 * lowercase hex slug like `<32-hex-chars>.md`.
 *
 * Timestamps are managed in a build-stable way:
 * - explicit `uploaded_at` / `updated_at` values in source are used as-is
 * - new files get both timestamps set to the current ISO datetime in output
 * - updated files preserve `uploaded_at` and bump `updated_at`
 * - unchanged files preserve both timestamps
 * - when source omits `uploaded_at`, it is backfilled into source
 * - when source omits `updated_at`, it stays auto-managed in output only
 *
 * Change detection intentionally does not rely on git history.
 * In this repo `posts-src` is git-ignored, so `git log -- src/content/posts-src`
 * cannot be the source of truth. Instead we compare the deterministic encrypted
 * output that would be produced for a source post against the current published
 * output file, which works the same locally and in CI/build environments.
 *
 * Usage:
 *   pnpm encrypt
 *   (runs automatically as a prebuild step via package.json)
 *
 * Requires Node.js 18+ (globalThis.crypto.subtle).
 */

import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import matter from 'gray-matter';
import { encrypt, encryptBody } from '../src/utils/crypto.js';

const SRC_DIR = new URL('../src/content/posts-src', import.meta.url).pathname;
const OUT_DIR = new URL('../src/content/posts', import.meta.url).pathname;
const SLUG_HEX_BYTES = 16;
const SLUG_HMAC_NAMESPACE = 'posts-slug-v1';

type AccessKeys = Record<string, string>;
type Frontmatter = Record<string, unknown>;
type TimestampField = 'uploaded_at' | 'updated_at';

type ParsedMarkdownFile = {
  path: string;
  raw: string;
  data: Frontmatter;
  content: string;
};

type SourceTimestampResolution = {
  uploadedAt: Date;
  updatedAt: Date;
  sourceUpdates: Partial<Record<TimestampField, string>>;
  changedMeaningfully: boolean;
  isNewPublication: boolean;
};

type ProcessResult =
  | { status: 'created' | 'updated' | 'unchanged'; targetFilename: string }
  | { status: 'skipped'; sourceFilename: string };

type RunSummary = {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  pruned: number;
  sourceTouched: number;
};

const hasOwn = (value: Frontmatter, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

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

const parseDateValue = (
  value: unknown,
  field: TimestampField,
  filename: string,
): Date => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`[error] ${filename} — "${field}" is not a valid date`);
    }
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  throw new Error(`[error] ${filename} — "${field}" is not a valid date`);
};

const getOptionalDate = (
  data: Frontmatter,
  field: TimestampField,
  filename: string,
): Date | null => {
  if (!hasOwn(data, field)) {
    return null;
  }

  const value = data[field];
  if (value == null) {
    return null;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  return parseDateValue(value, field, filename);
};

const parseMarkdownFile = async (path: string): Promise<ParsedMarkdownFile> => {
  const raw = await readFile(path, 'utf-8');
  const parsed = matter(raw);

  return {
    path,
    raw,
    data: parsed.data as Frontmatter,
    content: parsed.content,
  };
};

const normalizeLineEndings = (value: string): string =>
  value.replace(/\r\n/g, '\n');

const normalizeComparable = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeComparable);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, normalizeComparable(entryValue)]),
    );
  }

  return value;
};

const areEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(normalizeComparable(left)) === JSON.stringify(normalizeComparable(right));

const toBase64Url = (value: string): string =>
  value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const sourceStemFromFilename = (filename: string): string =>
  filename.slice(0, -extname(filename).length);

const deriveSourceStemSlug = async (
  sourceFilename: string,
  postKey: string,
): Promise<string> => {
  const hmacKey = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(postKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await globalThis.crypto.subtle.sign(
    'HMAC',
    hmacKey,
    new TextEncoder().encode(`${SLUG_HMAC_NAMESPACE}\x00${sourceStemFromFilename(sourceFilename)}`),
  );

  return Buffer
    .from(new Uint8Array(digest).subarray(0, SLUG_HEX_BYTES))
    .toString('hex');
};

const encryptSourceStemLegacySlug = async (
  sourceFilename: string,
  postKey: string,
): Promise<string> =>
  toBase64Url(await encrypt(sourceStemFromFilename(sourceFilename), postKey));

const encryptSourceStemLegacyHexSlug = async (
  sourceFilename: string,
  postKey: string,
): Promise<string> => {
  const encryptedStem = await encrypt(sourceStemFromFilename(sourceFilename), postKey);
  return Buffer.from(encryptedStem, 'base64').toString('hex');
};

const autoTimestampString = (value: Date): string => value.toISOString();

const publishedFrontmatterFromSource = ({
  sourceData,
  uploadedAt,
  updatedAt,
  accessEnvelopes,
}: {
  sourceData: Frontmatter;
  uploadedAt: Date;
  updatedAt: Date;
  accessEnvelopes?: AccessKeys;
}): Frontmatter => {
  const sourceCopy: Frontmatter = { ...sourceData };

  delete sourceCopy.key;
  delete sourceCopy.access_keys;
  delete sourceCopy.access_envelopes;
  delete sourceCopy.uploaded_at;
  delete sourceCopy.updated_at;

  const published: Frontmatter = {};

  const moveIfPresent = (key: string) => {
    if (!hasOwn(sourceCopy, key)) {
      return;
    }

    published[key] = sourceCopy[key];
    delete sourceCopy[key];
  };

  moveIfPresent('title');
  published.uploaded_at = uploadedAt;
  published.updated_at = updatedAt;
  moveIfPresent('author');
  moveIfPresent('draft');
  moveIfPresent('isProtected');
  moveIfPresent('description');

  for (const key of Object.keys(sourceCopy).sort((left, right) => left.localeCompare(right))) {
    published[key] = sourceCopy[key];
  }

  if (accessEnvelopes) {
    published.access_envelopes = accessEnvelopes;
  }

  published.is_protected = true;

  return published;
};

const withoutUpdatedAt = (data: Frontmatter): Frontmatter => {
  const next = { ...data };
  delete next.updated_at;
  return next;
};

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;

const upsertFrontmatterField = (
  frontmatter: string,
  field: TimestampField,
  value: string,
  eol: string,
): string => {
  const fieldPattern = new RegExp(`^${field}:\\s.*$`, 'm');

  if (fieldPattern.test(frontmatter)) {
    return frontmatter.replace(fieldPattern, `${field}: ${value}`);
  }

  return frontmatter ? `${frontmatter}${eol}${field}: ${value}` : `${field}: ${value}`;
};

const patchSourceFrontmatter = (
  raw: string,
  updates: Partial<Record<TimestampField, string>>,
): string => {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error('[error] source post is missing YAML frontmatter');
  }

  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  let frontmatter = match[1];

  for (const field of ['uploaded_at', 'updated_at'] as const) {
    const nextValue = updates[field];
    if (!nextValue) {
      continue;
    }

    frontmatter = upsertFrontmatterField(frontmatter, field, nextValue, eol);
  }

  const prefix = `---${eol}${frontmatter}${eol}---${match[2]}`;
  return `${prefix}${raw.slice(match[0].length)}`;
};

const resolveTimestamps = ({
  sourceFilename,
  sourceData,
  existingOutput,
  encryptedBody,
  accessEnvelopes,
  now,
}: {
  sourceFilename: string;
  sourceData: Frontmatter;
  existingOutput: ParsedMarkdownFile | null;
  encryptedBody: string;
  accessEnvelopes?: AccessKeys;
  now: Date;
}): SourceTimestampResolution => {
  const explicitUploadedAt = getOptionalDate(sourceData, 'uploaded_at', sourceFilename);
  const explicitUpdatedAt = getOptionalDate(sourceData, 'updated_at', sourceFilename);
  const existingUploadedAt = existingOutput
    ? getOptionalDate(existingOutput.data, 'uploaded_at', existingOutput.path)
    : null;
  const existingUpdatedAt = existingOutput
    ? getOptionalDate(existingOutput.data, 'updated_at', existingOutput.path)
    : null;

  const uploadedAt = explicitUploadedAt ?? existingUploadedAt ?? now;
  const comparableNextFrontmatter = publishedFrontmatterFromSource({
    sourceData,
    uploadedAt,
    updatedAt: existingUpdatedAt ?? uploadedAt,
    accessEnvelopes,
  });

  const comparableNext = {
    frontmatter: withoutUpdatedAt(comparableNextFrontmatter),
    content: normalizeLineEndings(encryptedBody),
  };
  const comparableExisting = existingOutput
    ? {
      frontmatter: withoutUpdatedAt(existingOutput.data),
      content: normalizeLineEndings(existingOutput.content),
    }
    : null;

  const changedMeaningfully =
    !comparableExisting || !areEqual(comparableExisting, comparableNext);

  const updatedAt = explicitUpdatedAt
    ?? (existingOutput
      ? (changedMeaningfully ? now : (existingUpdatedAt ?? uploadedAt))
      : now);

  const sourceUpdates: Partial<Record<TimestampField, string>> = {};
  if (!explicitUploadedAt) {
    sourceUpdates.uploaded_at = autoTimestampString(uploadedAt);
  }

  return {
    uploadedAt,
    updatedAt,
    sourceUpdates,
    changedMeaningfully,
    isNewPublication: !existingOutput,
  };
};

const readExistingPublishedFile = async (
  candidatePaths: readonly string[],
): Promise<ParsedMarkdownFile | null> => {
  for (const candidatePath of candidatePaths) {
    try {
      return await parseMarkdownFile(candidatePath);
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : null;

      if (code === 'ENOENT') {
        continue;
      }

      throw error;
    }
  }

  return null;
};

const writeSourceIfNeeded = async (
  sourcePath: string,
  sourceRaw: string,
  updates: Partial<Record<TimestampField, string>>,
): Promise<boolean> => {
  if (!updates.uploaded_at && !updates.updated_at) {
    return false;
  }

  const nextRaw = patchSourceFrontmatter(sourceRaw, updates);
  if (nextRaw === sourceRaw) {
    return false;
  }

  await writeFile(sourcePath, nextRaw, 'utf-8');
  return true;
};

const encryptPost = async (
  sourceFilename: string,
  now: Date,
): Promise<ProcessResult & { sourceTouched: boolean }> => {
  const sourcePath = join(SRC_DIR, sourceFilename);
  const sourceFile = await parseMarkdownFile(sourcePath);

  if (!sourceFile.content.trim()) {
    console.warn(`[skip] ${sourceFilename} — empty body`);
    return {
      status: 'skipped',
      sourceFilename,
      sourceTouched: false,
    };
  }

  const postKey = String(sourceFile.data.key ?? '').trim();
  if (!postKey) {
    throw new Error(`[error] ${sourceFilename} — missing or empty "key" field in frontmatter`);
  }

  const accessKeys = normalizeAccessKeys(sourceFile.data.access_keys, sourceFilename);
  const accessEnvelopes = accessKeys
    ? Object.fromEntries(
      await Promise.all(
        Object.entries(accessKeys)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(async ([kid, secret]) => [kid, await encrypt(postKey, secret)]),
      ),
    )
    : undefined;
  const encryptedBody = await encryptBody(sourceFile.content, postKey);
  const targetSlug = await deriveSourceStemSlug(sourceFilename, postKey);
  const legacyHexSlug = await encryptSourceStemLegacyHexSlug(sourceFilename, postKey);
  const legacyBase64Slug = await encryptSourceStemLegacySlug(sourceFilename, postKey);
  const targetFilename = `${targetSlug}.md`;
  const targetPath = join(OUT_DIR, targetFilename);
  const existingOutput = await readExistingPublishedFile([
    targetPath,
    join(OUT_DIR, `${legacyHexSlug}.md`),
    join(OUT_DIR, `${legacyBase64Slug}.md`),
    join(OUT_DIR, sourceFilename),
  ]);
  const resolvedTimestamps = resolveTimestamps({
    sourceFilename,
    sourceData: sourceFile.data,
    existingOutput,
    encryptedBody,
    accessEnvelopes,
    now,
  });

  const publishedFrontmatter = publishedFrontmatterFromSource({
    sourceData: sourceFile.data,
    uploadedAt: resolvedTimestamps.uploadedAt,
    updatedAt: resolvedTimestamps.updatedAt,
    accessEnvelopes,
  });
  const nextOutputRaw = matter.stringify(encryptedBody, publishedFrontmatter);
  const sourceTouched = await writeSourceIfNeeded(
    sourcePath,
    sourceFile.raw,
    resolvedTimestamps.sourceUpdates,
  );

  if (sourceTouched) {
    console.log(`[meta] ${sourceFilename}`);
  }

  if (existingOutput?.raw === nextOutputRaw && existingOutput.path === targetPath) {
    console.log(`[ok]   ${sourceFilename} -> ${targetFilename} (unchanged)`);
    return {
      status: 'unchanged',
      targetFilename,
      sourceTouched,
    };
  }

  await writeFile(targetPath, nextOutputRaw, 'utf-8');

  const status =
    resolvedTimestamps.isNewPublication ? 'created' : 'updated';
  console.log(`[ok]   ${sourceFilename} -> ${targetFilename} (${status})`);

  return {
    status,
    targetFilename,
    sourceTouched,
  };
};

const getSourceFiles = async (): Promise<string[]> => {
  try {
    return (await readdir(SRC_DIR))
      .filter((filename: string) => extname(filename) === '.md')
      .sort((left, right) => left.localeCompare(right));
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : null;

    if (code !== 'ENOENT') {
      throw error;
    }

    await mkdir(OUT_DIR, { recursive: true });

    const publishedFiles = (await readdir(OUT_DIR)).filter(
      (filename: string) => extname(filename) === '.md',
    );

    if (publishedFiles.length > 0) {
      console.warn('[skip] src/content/posts-src/ not found; using existing encrypted posts in src/content/posts/.');
    } else {
      console.warn('[skip] src/content/posts-src/ not found; continuing with an empty posts collection.');
    }

    return [];
  }
};

const pruneStaleOutputs = async (expectedFiles: ReadonlySet<string>): Promise<number> => {
  const publishedFiles = (await readdir(OUT_DIR))
    .filter((filename: string) => extname(filename) === '.md')
    .sort((left, right) => left.localeCompare(right));

  const staleFiles = publishedFiles.filter((filename) => !expectedFiles.has(filename));

  await Promise.all(
    staleFiles.map(async (filename) => {
      await unlink(join(OUT_DIR, filename));
      console.log(`[rm]   ${filename}`);
    }),
  );

  return staleFiles.length;
};

const run = async (): Promise<void> => {
  await mkdir(OUT_DIR, { recursive: true });
  const files = await getSourceFiles();

  if (files.length === 0) {
    console.log('No Markdown files found in posts-src/');
    return;
  }

  const now = new Date();
  const summary: RunSummary = {
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    pruned: 0,
    sourceTouched: 0,
  };
  const expectedFiles = new Set<string>();

  const rememberExpectedFile = (sourceFilename: string, targetFilename: string): void => {
    if (expectedFiles.has(targetFilename)) {
      throw new Error(
        `[error] slug collision for ${targetFilename} while processing ${sourceFilename}; ` +
        'increase slug length or rename one of the source posts.',
      );
    }

    expectedFiles.add(targetFilename);
  };

  for (const filename of files) {
    const result = await encryptPost(filename, now);

    if (result.sourceTouched) {
      summary.sourceTouched += 1;
    }

    switch (result.status) {
      case 'created':
        summary.created += 1;
        rememberExpectedFile(filename, result.targetFilename);
        break;
      case 'updated':
        summary.updated += 1;
        rememberExpectedFile(filename, result.targetFilename);
        break;
      case 'unchanged':
        summary.unchanged += 1;
        rememberExpectedFile(filename, result.targetFilename);
        break;
      case 'skipped':
        summary.skipped += 1;
        break;
      default:
        throw new Error(`[error] unhandled result status: ${(result satisfies never)}`);
    }
  }

  summary.pruned = await pruneStaleOutputs(expectedFiles);

  console.log(
    `\nDone: ${summary.created} created, ${summary.updated} updated, ` +
    `${summary.unchanged} unchanged, ${summary.skipped} skipped, ` +
    `${summary.pruned} pruned, ${summary.sourceTouched} source touched → src/content/posts/`,
  );
};

run().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
