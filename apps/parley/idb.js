// Tiny IndexedDB key/value store for things too big for localStorage:
// photos attached to chats and images generated on this device.
const DB = "r5k-files";
const STORE = "blobs";
let dbPromise = null;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const files = {
  put: (key, value) => tx("readwrite", (s) => s.put(value, key)),
  get: (key) => tx("readonly", (s) => s.get(key)),
  del: (key) => tx("readwrite", (s) => s.delete(key)),
  // Delete every entry whose key starts with prefix (used when an account is deleted).
  delPrefix: (prefix) => tx("readwrite", (s) => s.delete(IDBKeyRange.bound(prefix, prefix + "￿"))),
};

// Object URLs for stored blobs, cached so lists don't create new ones on every render.
const urlCache = new Map();
export async function blobUrl(key) {
  if (urlCache.has(key)) return urlCache.get(key);
  const v = await files.get(key).catch(() => null);
  if (!v) return null;
  const blob = v instanceof Blob ? v : await (await fetch(v)).blob();
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}
