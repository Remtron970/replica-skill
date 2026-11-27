/**
 * A local-first collection of records: kept in memory, saved to this device,
 * and (when signed in) synced with a Supabase table by the SyncEngine.
 *
 * Every record carries:
 *   id               generated on the device (works offline)
 *   clientUpdatedAt  when it was last changed here (ms) — newest change wins
 *   deleted          soft delete, so deletions reach other devices
 */

export type Source = "manual" | "csv" | "canvas" | "google_classroom" | "gmail" | "demo";

export interface SyncRecord {
  id: string;
  clientUpdatedAt: number;
  deleted: boolean;
  source: Source;
  externalId?: string | null;
}

interface Persisted<T> {
  rows: Record<string, T>;
  dirty: string[];
  cursor: string | null;
  /** Account these rows belong to; null = created on this device while signed out. */
  owner: string | null;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function safeStorage(): KeyValueStorage | null {
  try {
    const s = globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // RFC 4122 v4 fallback for older browsers.
    const b = new Uint8Array(16);
    for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
}

export type NewRecord<T extends SyncRecord> = Omit<T, "id" | "clientUpdatedAt" | "deleted" | "source"> &
  Partial<Pick<T, "id" | "source">>;

export class Collection<T extends SyncRecord> {
  private rows = new Map<string, T>();
  private dirty = new Set<string>();
  private cursor: string | null = null;
  private owner: string | null = null;
  private listeners = new Set<() => void>();
  private snapshot: T[] | null = null;
  private readonly storage: KeyValueStorage | null;
  private readonly key: string;
  /** Ensures each local change gets a strictly increasing timestamp. */
  private lastStamp = 0;

  constructor(
    readonly name: string,
    opts: { storage?: KeyValueStorage | null; now?: () => number } = {},
  ) {
    this.storage = opts.storage === undefined ? safeStorage() : opts.storage;
    this.now = opts.now ?? Date.now;
    this.key = `lt.c.${name}`;
    this.load();
  }

  private readonly now: () => number;

  // ---- persistence ----
  private load() {
    try {
      const raw = this.storage?.getItem(this.key);
      if (!raw) return;
      const p = JSON.parse(raw) as Persisted<T>;
      for (const [id, r] of Object.entries(p.rows ?? {})) this.rows.set(id, r);
      this.dirty = new Set((p.dirty ?? []).filter((id) => this.rows.has(id)));
      this.cursor = p.cursor ?? null;
      this.owner = p.owner ?? null;
    } catch {
      /* corrupt or blocked storage: start empty */
    }
  }

  private save() {
    const p: Persisted<T> = { rows: Object.fromEntries(this.rows), dirty: [...this.dirty], cursor: this.cursor, owner: this.owner };
    try {
      this.storage?.setItem(this.key, JSON.stringify(p));
    } catch {
      /* full or blocked: keep working in memory */
    }
  }

  private changed() {
    this.snapshot = null;
    this.save();
    this.listeners.forEach((l) => l());
  }

  private stamp() {
    this.lastStamp = Math.max(this.now(), this.lastStamp + 1);
    return this.lastStamp;
  }

  // ---- reading (stable references for React's useSyncExternalStore) ----
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Visible (non-deleted) records. Same array instance until something changes. */
  list = (): T[] => {
    if (!this.snapshot) this.snapshot = [...this.rows.values()].filter((r) => !r.deleted);
    return this.snapshot;
  };

  get(id: string): T | undefined {
    const r = this.rows.get(id);
    return r && !r.deleted ? r : undefined;
  }

  // ---- writing ----
  /** Create or replace a record. Returns the stored record. */
  put(input: NewRecord<T> | T): T {
    const id = (input as T).id ?? newId();
    const prev = this.rows.get(id);
    const rec = {
      ...prev,
      ...input,
      id,
      source: (input as T).source ?? prev?.source ?? "manual",
      deleted: false,
      clientUpdatedAt: this.stamp(),
    } as T;
    this.rows.set(id, rec);
    this.dirty.add(id);
    this.changed();
    return rec;
  }

  patch(id: string, changes: Partial<Omit<T, "id" | "clientUpdatedAt">>): T | undefined {
    const prev = this.rows.get(id);
    if (!prev) return undefined;
    const rec = { ...prev, ...changes, id, clientUpdatedAt: this.stamp() } as T;
    this.rows.set(id, rec);
    this.dirty.add(id);
    this.changed();
    return rec;
  }

  remove(id: string) {
    this.patch(id, { deleted: true } as Partial<T>);
  }

  /** Several changes as one update (one save, one re-render). */
  batch(fn: () => void) {
    const save = this.changed;
    let pending = false;
    this.changed = () => {
      pending = true;
    };
    try {
      fn();
    } finally {
      this.changed = save;
      if (pending) this.changed();
    }
  }

  // ---- sync support ----
  get dirtyCount() {
    return this.dirty.size;
  }

  dirtyRecords(): T[] {
    return [...this.dirty].map((id) => this.rows.get(id)!).filter(Boolean);
  }

  /** After a successful upload: clear the dirty flag unless the record changed meanwhile. */
  markSynced(sent: T[]) {
    let any = false;
    for (const s of sent) {
      const cur = this.rows.get(s.id);
      if (cur && cur.clientUpdatedAt === s.clientUpdatedAt && this.dirty.delete(s.id)) any = true;
    }
    if (any) this.save();
  }

  /**
   * Merge records downloaded from the server. A local change wins only if it is
   * newer and not yet uploaded; otherwise the server's copy replaces ours.
   */
  applyRemote(records: T[]) {
    let any = false;
    for (const remote of records) {
      const local = this.rows.get(remote.id);
      if (local && this.dirty.has(remote.id) && local.clientUpdatedAt > remote.clientUpdatedAt) continue;
      if (local && !this.dirty.has(remote.id) && local.clientUpdatedAt === remote.clientUpdatedAt && local.deleted === remote.deleted) continue;
      this.rows.set(remote.id, remote);
      this.dirty.delete(remote.id);
      any = true;
    }
    if (any) this.changed();
  }

  getCursor() {
    return this.cursor;
  }
  setCursor(c: string | null) {
    this.cursor = c;
    this.save();
  }

  getOwner() {
    return this.owner;
  }

  /**
   * Called when an account signs in. Device-only records (owner null) are adopted
   * by the account and uploaded; another account's cached records are dropped.
   */
  claim(userId: string) {
    if (this.owner === userId) return;
    if (this.owner && this.owner !== userId) {
      this.rows.clear();
      this.dirty.clear();
    } else {
      for (const id of this.rows.keys()) this.dirty.add(id);
    }
    this.owner = userId;
    this.cursor = null;
    this.changed();
  }

  /** Forget everything stored for this collection on this device. */
  clear() {
    this.rows.clear();
    this.dirty.clear();
    this.cursor = null;
    this.owner = null;
    this.snapshot = null;
    try {
      this.storage?.removeItem(this.key);
    } catch {
      /* ignore */
    }
    this.listeners.forEach((l) => l());
  }
}
