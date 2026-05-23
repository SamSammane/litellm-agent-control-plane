import { createDecipheriv } from "node:crypto";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

let _cachedKey: Buffer | null | undefined;

function getKey(): Buffer | null {
  if (_cachedKey !== undefined) return _cachedKey;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    _cachedKey = null;
    return null;
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be a base64-encoded 32-byte key. Generate one with: " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  _cachedKey = buf;
  return buf;
}

export function decrypt(stored: string): string {
  if (!stored.startsWith(PREFIX)) {
    // Legacy plaintext (pre-encryption) or dev-mode-no-key. Pass through.
    return stored;
  }
  const key = getKey();
  if (key === null) {
    throw new Error(
      "ENCRYPTION_KEY is required to decrypt a stored encrypted value",
    );
  }
  const buf = Buffer.from(stored.slice(PREFIX.length), "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("malformed encrypted value");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
