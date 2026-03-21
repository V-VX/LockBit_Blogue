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
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypts `plaintext` with `passphrase` using AES-256-GCM + PBKDF2-SHA256.
 * Returns a base64-encoded payload containing salt, IV, and ciphertext.
 */
export const encrypt = async (
  plaintext: string,
  passphrase: string,
): Promise<string> => {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
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

export class DecryptionError extends Error {
  override readonly name = 'DecryptionError';
  constructor(message: string) {
    super(message);
  }
}
