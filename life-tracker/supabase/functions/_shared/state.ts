/**
 * Signed, expiring OAuth "state" so the Google callback can trust which user
 * started the connection (and reject forged or replayed callbacks).
 */
const enc = new TextEncoder();
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(`oauth-state:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

export async function signState(secret: string, userId: string, ttlSeconds = 600, now = Date.now()) {
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(12)));
  const payload = `${userId}.${Math.floor(now / 1000) + ttlSeconds}.${nonce}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

/** Returns the user id if the state is genuine and unexpired, else null. */
export async function verifyState(secret: string, state: string, now = Date.now()): Promise<string | null> {
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [userId, exp, nonce, sig] = parts;
  const expected = await hmac(secret, `${userId}.${exp}.${nonce}`);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < now) return null;
  return /^[0-9a-f-]{36}$/i.test(userId) ? userId : null;
}
