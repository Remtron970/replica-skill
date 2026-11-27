import type { Collection, SyncRecord } from "./collection";

/** Server-side storage for one table (Supabase in the app, a fake in tests). */
export interface Remote {
  upsert(table: string, rows: Record<string, unknown>[]): Promise<void>;
  /** Rows changed after `since` (server time), oldest first. */
  pull(table: string, since: string | null, limit: number): Promise<Record<string, unknown>[]>;
}

export interface CollectionBinding<T extends SyncRecord> {
  collection: Collection<T>;
  table: string;
  toRow: (r: T, userId: string) => Record<string, unknown>;
  fromRow: (row: Record<string, unknown>) => T;
}

export type EngineStatus = { state: "idle" | "syncing" | "synced" | "error" | "offline"; lastSyncedAt?: Date; error?: string };

const PAGE = 500;
const PUSH_BATCH = 200;
/** Re-read a few seconds before the cursor so rows committed out of order aren't missed. */
const CURSOR_OVERLAP_MS = 5000;

function rewind(cursor: string) {
  const t = Date.parse(cursor);
  return Number.isFinite(t) ? new Date(t - CURSOR_OVERLAP_MS).toISOString() : cursor;
}

/** Push local changes, then pull remote ones, for each bound collection in order. */
export async function syncOnce(remote: Remote, bindings: CollectionBinding<SyncRecord>[], userId: string) {
  for (const b of bindings) {
    // 1. Upload changes made on this device.
    const dirty = b.collection.dirtyRecords();
    for (let i = 0; i < dirty.length; i += PUSH_BATCH) {
      const batch = dirty.slice(i, i + PUSH_BATCH);
      await remote.upsert(
        b.table,
        batch.map((r) => b.toRow(r, userId)),
      );
      b.collection.markSynced(batch);
    }

    // 2. Download changes made elsewhere.
    let cursor = b.collection.getCursor();
    for (;;) {
      const rows = await remote.pull(b.table, cursor ? rewind(cursor) : null, PAGE);
      if (!rows.length) break;
      b.collection.applyRemote(rows.map(b.fromRow));
      const last = rows[rows.length - 1].updated_at as string;
      const advanced = !cursor || Date.parse(last) > Date.parse(cursor);
      if (advanced) cursor = last;
      b.collection.setCursor(cursor);
      if (rows.length < PAGE || !advanced) break;
    }
  }
}
