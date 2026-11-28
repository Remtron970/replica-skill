import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/auth";
import { usePrefs } from "../../lib/prefs";
import { supabase } from "../../lib/supabase";
import type { Category } from "../../../../../supabase/functions/_shared/news/model.ts";
import type { Article } from "./newsLogic";
import { loadWeather, type Alert, type Weather } from "./weather";

export interface RegionStatus {
  region_key: string;
  label: string;
  last_refreshed_at: string | null;
  last_error: string | null;
}

const CACHE = "lt.news.cache";
const ASKED = "lt.news.refreshRequestedAt";
const REFRESH_MS = 30 * 60_000;

interface Row {
  id: string;
  region_key: string;
  provider: string;
  category: Category;
  title: string;
  summary: string | null;
  source_name: string;
  url: string;
  image_url: string | null;
  published_at: string;
  is_live: boolean;
}
const fromRow = (r: Row): Article => ({ id: r.id, regionKey: r.region_key, provider: r.provider, category: r.category, title: r.title, summary: r.summary, sourceName: r.source_name, url: r.url, imageUrl: r.image_url, publishedAt: r.published_at, isLive: r.is_live });

function readCache(): { articles: Article[]; regions: RegionStatus[]; checkedAt: number } {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || "null");
    if (c && Array.isArray(c.articles)) return c;
  } catch {
    /* none */
  }
  return { articles: [], regions: [], checkedAt: 0 };
}

/**
 * Articles from the shared server cache (world + your city). Opening News asks
 * the server to refresh if it's been 30+ minutes; the server decides whether a
 * refresh is actually due. The last result is kept on the device for offline use.
 */
export function useNews({ autoRefresh = true }: { autoRefresh?: boolean } = {}) {
  const { user } = useAuth();
  const { prefs } = usePrefs();
  const regionKey = prefs.news.location?.regionKey ?? null;
  const [state, setState] = useState(readCache);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = !!supabase && !!user;

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    const keys = ["world", ...(regionKey ? [regionKey] : [])];
    const since = new Date(Date.now() - 48 * 3_600_000).toISOString();
    const [a, r] = await Promise.all([
      supabase.from("news_articles").select("id, region_key, provider, category, title, summary, source_name, url, image_url, published_at, is_live").in("region_key", keys).gte("published_at", since).order("published_at", { ascending: false }).limit(300),
      supabase.from("news_regions").select("region_key, label, last_refreshed_at, last_error").in("region_key", keys),
    ]);
    if (a.error) return setError("Couldn't load news.");
    const next = { articles: (a.data as Row[]).map(fromRow), regions: (r.data as RegionStatus[]) ?? [], checkedAt: Date.now() };
    setState(next);
    setError(null);
    try {
      localStorage.setItem(CACHE, JSON.stringify(next));
    } catch {
      /* storage full */
    }
  }, [user, regionKey]);

  const refresh = useCallback(async () => {
    if (!supabase || !user) return;
    setBusy(true);
    try {
      localStorage.setItem(ASKED, String(Date.now()));
    } catch {
      /* storage blocked */
    }
    const { data, error: e } = await supabase.functions.invoke("news-refresh", { method: "POST", body: {} });
    if (e || !data?.ok) setError("Couldn't refresh news. Showing the last saved stories.");
    await load();
    setBusy(false);
  }, [user, load]);

  useEffect(() => {
    if (!available) return;
    let asked = 0;
    try {
      asked = Number(localStorage.getItem(ASKED)) || 0;
    } catch {
      /* none */
    }
    const stale = Date.now() - asked > REFRESH_MS;
    if (autoRefresh && stale) void refresh();
    else void load();
  }, [available, regionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Articles for a city you're no longer following aren't shown.
  const articles = useMemo(() => state.articles.filter((a) => a.regionKey === "world" || a.regionKey === regionKey), [state.articles, regionKey]);
  return { available, articles, regions: state.regions, checkedAt: state.checkedAt, busy, error, refresh };
}

export function useWeather() {
  const { prefs } = usePrefs();
  const place = prefs.news.location;
  const unit = prefs.news.tempUnit;
  const [s, setS] = useState<{ weather: Weather | null; alerts: Alert[] | null; error: string | null; loading: boolean }>({ weather: null, alerts: null, error: null, loading: !!place });
  const load = useCallback(
    async (force = false) => {
      if (!place) return setS({ weather: null, alerts: null, error: null, loading: false });
      setS((x) => ({ ...x, loading: true }));
      const r = await loadWeather(place, unit, { force }).catch(() => ({ weather: null, alerts: null, error: "Couldn't load the weather." }));
      setS({ weather: r.weather, alerts: r.alerts, error: r.error, loading: false });
    },
    [place, unit],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return { place, ...s, reload: () => load(true) };
}
