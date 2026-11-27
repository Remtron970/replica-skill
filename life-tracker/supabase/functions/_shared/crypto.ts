/**
 * AES-256-GCM for third-party tokens at rest. Uses the standard Web Crypto API
 * (available in Supabase Edge Functions and in Node), so it's testable locally.
 * The key is a 32-byte random value, base64, stored only as the
 * TOKEN_ENCRYPTION_KEY Edge Function secret.
 */

const b64 = {
  encode: (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)),
  decode: (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

export async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = b64.decode(base64Key);
  if (raw.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (base64)");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encrypt(key: CryptoKey, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)));
  return { ciphertext: b64.encode(ct), iv: b64.encode(iv) };
}

export async function decrypt(key: CryptoKey, ciphertext: string, iv: string): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64.decode(iv) }, key, b64.decode(ciphertext));
  return new TextDecoder().decode(pt);
}
