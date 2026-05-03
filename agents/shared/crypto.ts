import * as crypto from "crypto";

/**
 * Compute SHA-256 hash of a string and return as lowercase hex.
 * Used for proof_hash computation: sha256Hex(JSON.stringify(result))
 */
export const sha256Hex = (data: string): string =>
  crypto.createHash("sha256").update(data, "utf8").digest("hex");

/**
 * Convert a hex string to a 32-byte Uint8Array.
 * Used when sending proof_hash to the Anchor program (expects [u8; 32]).
 */
export const hexToBytes32 = (hex: string): Uint8Array => {
  if (hex.length !== 64) throw new Error(`Invalid hex length: ${hex.length} (expected 64)`);
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

/**
 * Generate a random 32-byte job ID and return as hex string.
 * Used by the Quant Agent to create unique job identifiers.
 */
export const generateJobId = (): string =>
  crypto.randomBytes(32).toString("hex");

/**
 * Verify an Ed25519 signature from the Analyst Agent callback.
 * WHY: Prevents a man-in-the-middle from injecting fake sentiment results.
 */
export const verifyEd25519Signature = (
  publicKeyHex: string,
  payloadJson: string,
  signatureHex: string
): boolean => {
  try {
    const publicKey = Buffer.from(publicKeyHex, "hex");
    const payload = Buffer.from(payloadJson, "utf8");
    const signature = Buffer.from(signatureHex, "hex");
    return crypto.verify(null, payload, { key: publicKey, format: "der", type: "spki" }, signature);
  } catch {
    return false;
  }
};

/**
 * Constant-time string comparison to prevent timing attacks on proof_hash checks.
 */
export const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
};
