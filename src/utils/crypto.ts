/**
 * Cross-environment AES-256-GCM encryption / decryption.
 *
 * Uses `globalThis.crypto.subtle` (Web Crypto API), which is available in:
 *   - Node.js 18+  (used by the build-time encrypt script)
 *   - All modern browsers  (used by the client-side decrypt component)
 *
 * Ciphertext binary layout (before base64 encoding):
 *   [0 .. 31]   32 bytes  PBKDF2 salt   (random per encryption)
 *   [32 .. 43]  12 bytes  AES-GCM IV    (random per encryption)
 *   [44 ..]     N  bytes  AES-GCM ciphertext + 16-byte auth tag
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 32;
const IV_BYTES = 12;
const KEY_BITS = 256;

// ---------------------------------------------------------------------------
// Buffer helpers (explicit ArrayBuffer to satisfy TS 5.7 strict typings)
// ---------------------------------------------------------------------------

const allocBuffer = (size: number): Uint8Array<ArrayBuffer> =>
  new Uint8Array(new ArrayBuffer(size));

const randomBytes = (size: number): Uint8Array<ArrayBuffer> => {
  const buf = allocBuffer(size);
  globalThis.crypto.getRandomValues(buf);
  return buf;
};

const toBase64 = (bytes: Uint8Array<ArrayBuffer>): string => {
  let binary = '';
  const CHUNK = 8_192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
};

const fromBase64 = (str: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(str);
  const bytes = allocBuffer(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

const deriveKey = async (
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> => {
  const subtle = globalThis.crypto.subtle;

  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
};

// ---------------------------------------------------------------------------
// Structured body tokenizer (sync, shared by encryptBody / decryptBody)
// ---------------------------------------------------------------------------

type Token =
  | { readonly type: 'passthrough'; readonly value: string }
  | { readonly type: 'text'; readonly value: string };

// Markdown line-start prefixes that are structural, not content.
const MD_LINE_PREFIX_RE =
  /^(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s*|={3,}|-{3,}|\*{3,}|`{3,}[^\n]*|\t|[ ]{4})/;

// Matches any HTML / XML tag (opening, closing, self-closing).
const HTML_TAG_SOURCE = '<[^>]*>';

const tokenizeLine = (line: string): readonly Token[] => {
  const tokens: Token[] = [];

  const prefixMatch = line.match(MD_LINE_PREFIX_RE);
  const prefix = prefixMatch?.[0] ?? '';
  const rest = line.slice(prefix.length);

  if (prefix) tokens.push({ type: 'passthrough', value: prefix });

  let cursor = 0;
  const tagRe = new RegExp(HTML_TAG_SOURCE, 'g');
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(rest)) !== null) {
    if (match.index > cursor) {
      tokens.push({ type: 'text', value: rest.slice(cursor, match.index) });
    }
    tokens.push({ type: 'passthrough', value: match[0] });
    cursor = match.index + match[0].length;
  }

  if (cursor < rest.length) {
    tokens.push({ type: 'text', value: rest.slice(cursor) });
  }

  return tokens;
};

const tokenize = (text: string): readonly Token[] => {
  const lines = text.split('\n');
  const tokens: Token[] = [];

  lines.forEach((line, i) => {
    if (i > 0) tokens.push({ type: 'passthrough', value: '\n' });
    tokens.push(...tokenizeLine(line));
  });

  return tokens;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derives salt and IV deterministically from (passphrase, plaintext) via
 * SHA-256 so that the same inputs always produce the same ciphertext.
 * Null-byte delimiters prevent prefix-collision between the two fields.
 */
const deriveNonce = async (
  passphrase: string,
  plaintext: string,
): Promise<{ readonly salt: Uint8Array<ArrayBuffer>; readonly iv: Uint8Array<ArrayBuffer> }> => {
  const enc = new TextEncoder();
  const [saltDigest, ivDigest] = await Promise.all([
    globalThis.crypto.subtle.digest('SHA-256', enc.encode(passphrase + '\x00salt\x00' + plaintext)),
    globalThis.crypto.subtle.digest('SHA-256', enc.encode(passphrase + '\x00iv\x00' + plaintext)),
  ]);
  return {
    salt: new Uint8Array(saltDigest).slice(0, SALT_BYTES) as Uint8Array<ArrayBuffer>,
    iv: new Uint8Array(ivDigest).slice(0, IV_BYTES) as Uint8Array<ArrayBuffer>,
  };
};

/**
 * Encrypts `plaintext` with `passphrase` using AES-256-GCM + PBKDF2-SHA256.
 * Salt and IV are derived deterministically: same key + same plaintext always
 * produce the same ciphertext, making re-encryption safe and idempotent.
 * Returns a base64-encoded payload containing salt, IV, and ciphertext.
 */
export const encrypt = async (
  plaintext: string,
  passphrase: string,
): Promise<string> => {
  const { salt, iv } = await deriveNonce(passphrase, plaintext);
  const key = await deriveKey(passphrase, salt);

  const cipherBuffer = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  const combined = allocBuffer(SALT_BYTES + IV_BYTES + cipherBuffer.byteLength);
  combined.set(salt, 0);
  combined.set(iv, SALT_BYTES);
  combined.set(new Uint8Array(cipherBuffer), SALT_BYTES + IV_BYTES);

  return toBase64(combined);
};

/**
 * Decrypts a base64 payload produced by `encrypt`.
 * Throws `DecryptionError` if the passphrase is wrong or the payload is corrupt.
 */
export const decrypt = async (
  payload: string,
  passphrase: string,
): Promise<string> => {
  const combined = fromBase64(payload.trim());

  const salt = combined.slice(0, SALT_BYTES) as Uint8Array<ArrayBuffer>;
  const iv = combined.slice(SALT_BYTES, SALT_BYTES + IV_BYTES) as Uint8Array<ArrayBuffer>;
  const ciphertext = combined.slice(SALT_BYTES + IV_BYTES) as Uint8Array<ArrayBuffer>;

  const key = await deriveKey(passphrase, salt);

  let plainBuffer: ArrayBuffer;
  try {
    plainBuffer = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );
  } catch {
    throw new DecryptionError('Decryption failed — wrong key or corrupted payload.');
  }

  return new TextDecoder().decode(plainBuffer);
};

/**
 * Encrypts a markdown/HTML document token-by-token.
 * Markdown line-start prefixes and HTML tags are passed through unchanged;
 * only text content is encrypted.
 */
export const encryptBody = async (
  plaintext: string,
  passphrase: string,
): Promise<string> => {
  const tokens = tokenize(plaintext);
  const parts = await Promise.all(
    tokens.map(token =>
      token.type === 'text' && token.value.trim()
        ? encrypt(token.value, passphrase)
        : Promise.resolve(token.value),
    ),
  );
  return parts.join('');
};

/**
 * Decrypts a body produced by `encryptBody`.
 * Uses the same tokenizer so structural tokens are skipped;
 * each text token (a base64 ciphertext) is decrypted in place.
 */
export const decryptBody = async (
  body: string,
  passphrase: string,
): Promise<string> => {
  const tokens = tokenize(body);
  const parts = await Promise.all(
    tokens.map(token =>
      token.type === 'text' && token.value.trim()
        ? decrypt(token.value, passphrase)
        : Promise.resolve(token.value),
    ),
  );
  return parts.join('');
};

export class DecryptionError extends Error {
  override readonly name = 'DecryptionError';
  constructor(message: string) {
    super(message);
  }
}
