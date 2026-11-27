import { describe, expect, it } from "vitest";
import { Collection, type KeyValueStorage, type SyncRecord } from "./collection";
import { syncOnce, type CollectionBinding, type Remote } from "./engine";

interface Note extends SyncRecord {
  title: string;
}

/** In-memory stand-in for a Supabase table with the sync_row_guard trigger's rules. */
class FakeServer implements Remote {
  rows = new Map<string, Record<string, unknown>>();
  private tick = Date.UTC(2026, 10, 27);
  failNext = false;
  onUpsert?: () => void;

  async upsert(_table: string, rows: Record<string, unknown>[]) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("network down");
    }
    this.onUpsert?.();
    for (const row of rows) {
      const cur = this.rows.get(row.id as string);
      if (cur && cur.user_id !== row.user_id) throw new Error("row-level security");
      if (cur && Date.parse(row.client_updated_at as string) < Date.parse(cur.client_updated_at as string)) continue; // stale
      this.rows.set(row.id as string, { ...row, updated_at: new Date(++this.tick).toISOString() });
    }
  }

  async pull(_table: string, since: string | null, limit: number) {
    return [...this.rows.values()]
      .filter((r) => !since || Date.parse(r.updated_at as string) > Date.parse(since))
      .sort((a, b) => Date.parse(a.updated_at as string) - Date.parse(b.updated_at as string))
      .slice(0, limit);
  }
}

class MemStorage implements KeyValueStorage {
  m = new Map<string, string>();
  getItem = (k: string) => this.m.get(k) ?? null;
  setItem = (k: string, v: string) => void this.m.set(k, v);
  removeItem = (k: string) => void this.m.delete(k);
}

function device(clock: { t: number }, storage = new MemStorage()) {
  const notes = new Collection<Note>("notes", { storage, now: () => clock.t });
  const binding: CollectionBinding<Note> = {
    collection: notes,
    table: "notes",
    toRow: (r, user) => ({ id: r.id, user_id: user, client_updated_at: new Date(r.clientUpdatedAt).toISOString(), deleted: r.deleted, source: r.source, external_id: r.externalId ?? null, title: r.title }),
    fromRow: (row) => ({ id: row.id as string, clientUpdatedAt: Date.parse(row.client_updated_at as string), deleted: row.deleted as boolean, source: row.source as Note["source"], externalId: row.external_id as string | null, title: row.title as string }),
  };
  const sync = (server: Remote, user = "u1") => syncOnce(server, [binding as unknown as CollectionBinding<SyncRecord>], user);
  return { notes, sync, storage };
}

const U = "u1";

describe("sync engine", () => {
  it("uploads notes made offline before sign-in, and another device downloads them", async () => {
    const server = new FakeServer();
    const a = device({ t: 1000 });
    const n = a.notes.put({ title: "Biology" });
    expect(a.notes.dirtyCount).toBe(1);
    a.notes.claim(U);
    await a.sync(server);
    expect(a.notes.dirtyCount).toBe(0);
    expect(server.rows.get(n.id)?.title).toBe("Biology");

    const b = device({ t: 5000 });
    b.notes.claim(U);
    await b.sync(server);
    expect(b.notes.list().map((x) => x.title)).toEqual(["Biology"]);
  });

  it("newest edit wins when two devices change the same record", async () => {
    const server = new FakeServer();
    const ca = { t: 1000 };
    const cb = { t: 1000 };
    const a = device(ca);
    const b = device(cb);
    a.notes.claim(U);
    b.notes.claim(U);
    const n = a.notes.put({ title: "v1" });
    await a.sync(server);
    await b.sync(server);

    ca.t = 2000;
    a.notes.patch(n.id, { title: "A's older edit (offline)" });
    cb.t = 3000;
    b.notes.patch(n.id, { title: "B's newer edit" });
    await b.sync(server);
    await a.sync(server); // A's stale upload is ignored, then A downloads B's version
    await b.sync(server);

    expect(server.rows.get(n.id)?.title).toBe("B's newer edit");
    expect(a.notes.get(n.id)?.title).toBe("B's newer edit");
    expect(b.notes.get(n.id)?.title).toBe("B's newer edit");
    expect(a.notes.dirtyCount + b.notes.dirtyCount).toBe(0);
  });

  it("a newer local edit survives a download of an older server copy", async () => {
    const server = new FakeServer();
    const ca = { t: 1000 };
    const cb = { t: 1000 };
    const a = device(ca);
    const b = device(cb);
    a.notes.claim(U);
    b.notes.claim(U);
    const n = a.notes.put({ title: "v1" });
    await a.sync(server);
    await b.sync(server);
    cb.t = 2000;
    b.notes.patch(n.id, { title: "B older" });
    await b.sync(server);
    ca.t = 3000;
    a.notes.patch(n.id, { title: "A newer" });
    await a.sync(server);
    await b.sync(server);
    expect(a.notes.get(n.id)?.title).toBe("A newer");
    expect(b.notes.get(n.id)?.title).toBe("A newer");
  });

  it("deletions reach the other device", async () => {
    const server = new FakeServer();
    const ca = { t: 1000 };
    const a = device(ca);
    const b = device({ t: 1000 });
    a.notes.claim(U);
    b.notes.claim(U);
    const n = a.notes.put({ title: "Temp" });
    await a.sync(server);
    await b.sync(server);
    expect(b.notes.list()).toHaveLength(1);
    ca.t = 2000;
    a.notes.remove(n.id);
    expect(a.notes.list()).toHaveLength(0);
    await a.sync(server);
    await b.sync(server);
    expect(b.notes.list()).toHaveLength(0);
    expect(b.notes.get(n.id)).toBeUndefined();
  });

  it("keeps changes queued when the upload fails, and sends them next time", async () => {
    const server = new FakeServer();
    const a = device({ t: 1000 });
    a.notes.claim(U);
    a.notes.put({ title: "Offline" });
    server.failNext = true;
    await expect(a.sync(server)).rejects.toThrow("network down");
    expect(a.notes.dirtyCount).toBe(1);
    await a.sync(server);
    expect(a.notes.dirtyCount).toBe(0);
    expect(server.rows.size).toBe(1);
  });

  it("an edit made while an upload is in flight stays queued", async () => {
    const server = new FakeServer();
    const clock = { t: 1000 };
    const a = device(clock);
    a.notes.claim(U);
    const n = a.notes.put({ title: "first" });
    server.onUpsert = () => {
      server.onUpsert = undefined;
      clock.t = 1500;
      a.notes.patch(n.id, { title: "typed during upload" });
    };
    await a.sync(server);
    expect(a.notes.dirtyCount).toBe(1);
    expect(a.notes.get(n.id)?.title).toBe("typed during upload");
    await a.sync(server);
    expect(server.rows.get(n.id)?.title).toBe("typed during upload");
  });

  it("survives a reload: rows, queue and cursor are saved on the device", async () => {
    const server = new FakeServer();
    const storage = new MemStorage();
    const a = device({ t: 1000 }, storage);
    a.notes.claim(U);
    a.notes.put({ title: "Saved" });
    const reloaded = device({ t: 2000 }, storage);
    expect(reloaded.notes.list().map((x) => x.title)).toEqual(["Saved"]);
    expect(reloaded.notes.dirtyCount).toBe(1);
    expect(reloaded.notes.getOwner()).toBe(U);
    await reloaded.sync(server);
    expect(device({ t: 3000 }, storage).notes.getCursor()).not.toBeNull();
  });

  it("signing in as a different account drops the previous account's cached data", () => {
    const a = device({ t: 1000 });
    a.notes.claim("someone-else");
    a.notes.put({ title: "Not yours" });
    a.notes.claim(U);
    expect(a.notes.list()).toHaveLength(0);
    expect(a.notes.dirtyCount).toBe(0);
  });

  it("clearing leaves nothing stored on the device", () => {
    const storage = new MemStorage();
    const a = device({ t: 1000 }, storage);
    a.notes.put({ title: "x" });
    expect(storage.m.size).toBe(1);
    a.notes.clear();
    expect(storage.m.size).toBe(0);
    expect(a.notes.list()).toEqual([]);
  });

  it("gives each change a strictly increasing timestamp even within one millisecond", () => {
    const a = device({ t: 1000 });
    const n = a.notes.put({ title: "x" });
    const p = a.notes.patch(n.id, { title: "y" })!;
    expect(p.clientUpdatedAt).toBeGreaterThan(n.clientUpdatedAt);
  });

  it("list() returns the same array until something changes (no extra re-renders)", () => {
    const a = device({ t: 1000 });
    a.notes.put({ title: "x" });
    const first = a.notes.list();
    expect(a.notes.list()).toBe(first);
    a.notes.put({ title: "y" });
    expect(a.notes.list()).not.toBe(first);
  });
});
