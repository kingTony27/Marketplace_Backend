import crypto from "crypto";

// Alchemy signs the RAW request body with HMAC-SHA256 using this webhook's signing key,
// and sends the hex result in the `x-alchemy-signature` header.
export function isValidSignature(rawBody: string, signature: string, signingKey: string): boolean {
  const expected = crypto.createHmac("sha256", signingKey).update(rawBody, "utf8").digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  // timingSafeEqual throws if the lengths differ, so check first
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}