/** In-memory stand-in for the parts of supabase-js the sync functions use. Test-only. */
export function fakeDb(extra: Record<string, Record<string, unknown>[]> = {}) {
  const tables: Record<string, Record<string, unknown>[]> = { sync_runs: [], integration_tokens: [], integrations: [{ id: "int1", status: "connected" }], courses: [], grade_categories: [], grade_items: [], assignments: [], emails: [], ...extra };
  const from = (t: string) => {
    let rows = () => tables[t];
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    let pendingUpdate: Record<string, unknown> | null = null;
    const apply = () => {
      const hit = rows().filter((r) => filters.every((f) => f(r)));
      if (pendingUpdate) hit.forEach((r) => Object.assign(r, pendingUpdate));
      return hit;
    };
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
      single: async () => ({ data: apply()[0] ?? null, error: apply()[0] ? null : { message: "none" } }),
      insert: (row: Record<string, unknown>) => {
        const r = { id: `${t}-${tables[t].length + 1}`, ...row };
        tables[t].push(r);
        rows = () => [r];
        return q;
      },
      upsert: async (input: Record<string, unknown> | Record<string, unknown>[]) => {
        for (const row of Array.isArray(input) ? input : [input]) {
          const k = t === "integration_tokens" ? "integration_id" : "id";
          const cur = tables[t].find((r) => r[k] === row[k]);
          if (cur) Object.assign(cur, row);
          else tables[t].push({ ...row });
        }
        return { error: null };
      },
      update: (patch: Record<string, unknown>) => ((pendingUpdate = patch), q),
      then: (res: (v: unknown) => void) => res({ data: apply(), error: null }),
    };
    return q;
  };
  return { tables, db: { from } };
}

