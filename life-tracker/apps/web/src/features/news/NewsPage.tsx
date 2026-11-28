import { AlertTriangle, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, ExternalLink, EyeOff, MapPin, RefreshCw, Search, Settings2, Sun, Wind, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SECTION_BY_ID } from "../../app/sections";
import { Badge, Button, Card, Chip, PageHeader, SectionCard, SegmentedControl, Sheet, Spinner, TextField, useToast } from "../../components/ui";
import { usePrefs } from "../../lib/prefs";
import { NEWS_CATEGORIES, type NewsCategory } from "../../lib/sync";
import { supabase } from "../../lib/supabase";
import { useNow } from "../../lib/time";
import { CATEGORY_LABEL, feed, groupStories, relTime, type Story } from "./newsLogic";
import { useNews, useWeather } from "./useNews";
import { describeCode, geocodeUrl, parseGeocode, type Alert, type Place, type Weather } from "./weather";

const ICONS = { clear: Sun, partly: CloudSun, cloudy: Cloud, fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, snow: CloudSnow, storm: CloudLightning };
const TABS: (NewsCategory | "top")[] = ["top", "local", "world", "us", "politics", "business", "technology", "science", "health", "sports", "entertainment"];

export function NewsPage() {
  const sec = SECTION_BY_ID.news;
  const { prefs } = usePrefs();
  const s = prefs.news;
  const now = useNow(60_000);
  const news = useNews();
  const wx = useWeather();
  const [tab, setTab] = useState<NewsCategory | "top">("top");
  const [panel, setPanel] = useState<null | "settings" | "city">(null);

  const stories = useMemo(() => groupStories(news.articles, now), [news.articles, now]);
  const shown = feed(stories, { category: tab, hidden: s.hidden, muted: s.muted });
  const tabs = TABS.filter((t) => t === "top" || (!s.hidden.includes(t) && (t !== "local" || s.location)));

  return (
    <>
      <PageHeader
        title="News"
        subtitle={s.location ? s.location.label : sec.tagline}
        icon={sec.icon}
        accent={sec.accent}
        right={
          <div className="flex gap-2">
            {news.available && (
              <Button size="sm" variant="secondary" icon={RefreshCw} loading={news.busy} onClick={() => void news.refresh()} aria-label="Refresh news">
                Refresh
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={Settings2} onClick={() => setPanel("settings")} aria-label="News settings">
              Settings
            </Button>
          </div>
        }
      />

      <div className="space-y-5">
        {!s.location ? (
          <SectionCard title="Choose your city" subtitle="For local news, the weather and official weather alerts. Only the city is saved." icon={MapPin} accent="bg-accent-red/10 text-accent-red">
            <CityPicker onDone={() => undefined} />
          </SectionCard>
        ) : (
          <>
            {wx.alerts?.map((a) => <AlertCard key={a.id} a={a} />)}
            <WeatherCard place={s.location} weather={wx.weather} loading={wx.loading} error={wx.error} onRetry={wx.reload} />
          </>
        )}

        {!news.available ? (
          <NeedsCloud />
        ) : (
          <section aria-labelledby="stories-h">
            <h2 id="stories-h" className="sr-only" tabIndex={-1}>
              Stories
            </h2>
            <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 whitespace-nowrap md:mx-0 md:flex-wrap md:px-0 [&>*]:shrink-0" role="group" aria-label="Choose a section">
              {tabs.map((t) => (
                <Chip key={t} selected={tab === t} onClick={() => setTab(t)}>
                  {t === "top" ? "Top stories" : CATEGORY_LABEL[t]}
                </Chip>
              ))}
            </div>
            <SourcesLine regions={news.regions} checkedAt={news.checkedAt} error={news.error} now={now} />
            {shown.length ? (
              <ul className="space-y-3">
                {shown.slice(0, 60).map((st) => (
                  <li key={st.lead.id}>
                    <StoryCard st={st} now={now} />
                  </li>
                ))}
              </ul>
            ) : (
              <Card className="text-[14px] text-muted">
                {news.busy ? (
                  <span className="flex items-center gap-2">
                    <Spinner /> Getting the latest stories…
                  </span>
                ) : news.articles.length ? (
                  "No stories in this section right now."
                ) : (
                  "No stories yet. Tap Refresh. If it stays empty, the news function may not be set up yet (docs/SETUP_NEWS.md)."
                )}
              </Card>
            )}
          </section>
        )}
      </div>

      <Sheet open={panel === "settings"} onClose={() => setPanel(null)} title="News settings">
        <NewsSettingsForm onChangeCity={() => setPanel("city")} />
      </Sheet>
      <Sheet open={panel === "city"} onClose={() => setPanel(null)} title="Choose your city">
        <CityPicker onDone={() => setPanel(null)} />
      </Sheet>
    </>
  );
}

function NeedsCloud() {
  const navigate = useNavigate();
  return (
    <SectionCard title="Headlines need cloud sync" icon={SECTION_BY_ID.news.icon} accent="bg-accent-red/10 text-accent-red">
      <p className="mb-3 text-[14px] text-muted">News is gathered by Life Tracker's server (so API keys stay private and free limits aren't used up). Weather and alerts above work without it.</p>
      <Button variant="secondary" onClick={() => navigate("/account")}>
        {supabase ? "Sign in to see headlines" : "Set up cloud sync to see headlines"}
      </Button>
    </SectionCard>
  );
}

function SourcesLine({ regions, checkedAt, error, now }: { regions: { region_key: string; last_refreshed_at: string | null; last_error: string | null }[]; checkedAt: number; error: string | null; now: Date }) {
  const newest = regions.map((r) => r.last_refreshed_at).filter((x): x is string => !!x).sort().pop();
  const problems = regions.map((r) => r.last_error).filter(Boolean);
  return (
    <div className="mb-3 space-y-1 text-[12.5px] text-muted">
      <p>{newest ? `Updated ${relTime(newest, now)}.` : checkedAt ? "Not updated yet." : ""} Every story links to the original. “Reported by” counts outlets; it doesn't mean a story is confirmed.</p>
      {(error || problems.length > 0) && (
        <p className="flex items-start gap-1.5 text-accent-yellow">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error ?? `Some sources didn't answer: ${problems.join("; ")}`}</span>
        </p>
      )}
    </div>
  );
}

function StoryCard({ st, now }: { st: Story; now: Date }) {
  const { prefs, update } = usePrefs();
  const toast = useToast();
  const a = st.lead;
  const mute = () => {
    update({ news: { ...prefs.news, muted: [...prefs.news.muted, a.sourceName] } });
    // The card disappears; keep keyboard focus in the story list.
    requestAnimationFrame(() => document.getElementById("stories-h")?.focus());
    toast({ tone: "info", title: `Hiding stories from ${a.sourceName}`, action: { label: "Undo", onClick: () => update({ news: { ...prefs.news, muted: prefs.news.muted.filter((m) => m !== a.sourceName) } }) } });
  };
  return (
    <Card className="flex gap-3">
      <div className="min-w-0 flex-1">
        <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
          <span className="font-semibold text-ink">{a.sourceName}</span>
          <span aria-hidden>·</span>
          <time dateTime={a.publishedAt}>{relTime(a.publishedAt, now)}</time>
          <span aria-hidden>·</span>
          <span>{CATEGORY_LABEL[a.category]}</span>
        </p>
        <div className="mb-1 flex flex-wrap gap-1.5">
          {st.breaking ? <Badge tone="danger">Breaking</Badge> : st.developing && <Badge tone="warning">Developing</Badge>}
          {st.sources.length > 1 && <Badge tone="info">Reported by {st.sources.length} outlets</Badge>}
        </div>
        <h3 className="text-[15.5px] font-semibold leading-snug">
          <a href={a.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {a.title}
            <span className="sr-only"> (opens {a.sourceName})</span>
          </a>
        </h3>
        {a.summary && <p className="mt-1 line-clamp-3 text-[13.5px] text-muted">{a.summary}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
          <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-ink">
            Read at {a.sourceName} <ExternalLink size={12} aria-hidden />
          </a>
          {st.others.slice(0, 3).map((o) => (
            <a key={o.id} href={o.url} target="_blank" rel="noopener noreferrer" className="text-muted underline-offset-2 hover:underline">
              {o.sourceName}
            </a>
          ))}
          <button type="button" onClick={mute} className="ml-auto inline-flex items-center gap-1 text-muted hover:text-ink">
            <EyeOff size={12} aria-hidden /> Hide {a.sourceName}
          </button>
        </div>
      </div>
      {a.imageUrl && <img src={a.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="hidden h-20 w-28 shrink-0 rounded-xl object-cover sm:block" onError={(e) => (e.currentTarget.style.display = "none")} />}
    </Card>
  );
}

const deg = (n: number) => `${n}°`;
const fmtWhen = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }) : null);

function AlertCard({ a }: { a: Alert }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className={a.isWarning ? "border-accent-red/40 bg-accent-red/6" : "border-accent-yellow/40 bg-accent-yellow/8"}>
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className={`mt-0.5 shrink-0 ${a.isWarning ? "text-accent-red" : "text-accent-yellow"}`} aria-hidden />
        <div className="min-w-0 flex-1 text-[13.5px]">
          <p className="font-semibold">
            {a.event} <Badge tone={a.isWarning ? "danger" : "warning"}>National Weather Service</Badge>
          </p>
          <p className="text-muted">
            {a.area}
            {a.ends ? ` · until ${fmtWhen(a.ends)}` : ""}
          </p>
          {open && (
            <div className="mt-2 space-y-2 whitespace-pre-line">
              <p>{a.description}</p>
              {a.instruction && <p className="font-medium">{a.instruction}</p>}
            </div>
          )}
          <div className="mt-1.5 flex gap-3">
            <button type="button" className="font-semibold text-brand-ink" aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? "Less" : "Details"}
            </button>
            <a href="https://www.weather.gov/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted">
              weather.gov <ExternalLink size={12} aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </Card>
  );
}

function WeatherCard({ place, weather, loading, error, onRetry }: { place: Place; weather: Weather | null; loading: boolean; error: string | null; onRetry: () => void }) {
  if (!weather) {
    return (
      <Card className="flex items-center gap-3 text-[14px]">
        {loading ? (
          <>
            <Spinner /> Getting the weather for {place.label}…
          </>
        ) : (
          <>
            <span className="flex-1 text-muted">{error ?? "No weather yet."}</span>
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          </>
        )}
      </Card>
    );
  }
  const c = describeCode(weather.current.code);
  const Icon = ICONS[c.kind];
  return (
    <SectionCard title={`Weather · ${place.label.split(",")[0]}`} subtitle={error ?? undefined} icon={Icon} accent="bg-accent-blue/10 text-accent-blue">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <p className="tabular text-[40px] font-bold leading-none">{deg(weather.current.temp)}</p>
        <div className="text-[13.5px]">
          <p className="font-semibold">{c.label}</p>
          <p className="text-muted">
            Feels like {deg(weather.current.feelsLike)} · <Wind size={13} className="inline" aria-hidden /> {weather.current.wind} {weather.unit === "f" ? "mph" : "km/h"}
          </p>
        </div>
      </div>
      <ul className="mt-4 grid grid-cols-5 gap-1.5 text-center text-[12.5px]" aria-label="Five-day forecast">
        {weather.days.slice(0, 5).map((d, i) => {
          const dc = describeCode(d.code);
          const DIcon = ICONS[dc.kind];
          return (
            <li key={d.date} className="rounded-xl bg-surface-2/70 px-1 py-2">
              <p className="font-semibold">{i === 0 ? "Today" : new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</p>
              <DIcon size={18} className="mx-auto my-1 text-muted" aria-label={dc.label} />
              <p className="tabular">
                {deg(d.hi)} <span className="text-muted">{deg(d.lo)}</span>
              </p>
              {d.precipChance !== null && d.precipChance >= 20 && <p className="text-muted">{d.precipChance}%</p>}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[12px] text-muted">Forecast: Open-Meteo{place.country === "US" ? " · Alerts: National Weather Service" : ""}</p>
    </SectionCard>
  );
}

function CityPicker({ onDone }: { onDone: () => void }) {
  const { prefs, update } = usePrefs();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Place[] | null>(null);
  const [error, setError] = useState<string>();

  const search = async () => {
    if (q.trim().length < 2) return setError("Type a city name.");
    setError(undefined);
    setBusy(true);
    try {
      const r = await fetch(geocodeUrl(q));
      if (!r.ok) throw new Error();
      const list = parseGeocode(await r.json());
      setResults(list);
      if (!list.length) setError("No city found. Check the spelling.");
    } catch {
      setError("Couldn't search right now. Check your connection.");
    }
    setBusy(false);
  };
  const choose = (p: Place) => {
    update({ news: { ...prefs.news, location: p } });
    toast({ tone: "success", title: `Showing news and weather for ${p.label}` });
    setResults(null);
    setQ("");
    onDone();
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void search();
      }}
    >
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextField label="City" placeholder="e.g. Grand Junction" value={q} onChange={(e) => setQ(e.target.value)} error={error} autoComplete="address-level2" />
        </div>
        <Button type="submit" icon={Search} loading={busy}>
          Search
        </Button>
      </div>
      {results && results.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl border border-line" aria-label="Matching cities">
          {results.map((p) => (
            <li key={p.regionKey}>
              <button type="button" onClick={() => choose(p)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[14px] hover:bg-surface-2">
                <MapPin size={15} className="text-muted" aria-hidden /> {p.label}
                {p.country && p.country !== "US" ? ` (${p.country})` : ""}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

function NewsSettingsForm({ onChangeCity }: { onChangeCity: () => void }) {
  const { prefs, update } = usePrefs();
  const s = prefs.news;
  const set = (patch: Partial<typeof s>) => update({ news: { ...s, ...patch } });
  return (
    <div className="space-y-5 text-[14px]">
      <div>
        <p className="mb-1.5 font-semibold">City</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted">{s.location?.label ?? "Not chosen"}</span>
          <Button size="sm" variant="secondary" icon={MapPin} onClick={onChangeCity}>
            {s.location ? "Change" : "Choose"}
          </Button>
          {s.location && (
            <Button size="sm" variant="ghost" icon={X} onClick={() => set({ location: null })}>
              Remove
            </Button>
          )}
        </div>
      </div>
      <SegmentedControl
        label="Temperature"
        value={s.tempUnit}
        onChange={(tempUnit) => set({ tempUnit })}
        options={[
          { value: "f", label: "°F" },
          { value: "c", label: "°C" },
        ]}
      />
      <div>
        <p className="mb-1.5 font-semibold">Sections to show</p>
        <div className="flex flex-wrap gap-2">
          {NEWS_CATEGORIES.map((c) => {
            const on = !s.hidden.includes(c);
            return (
              <Chip key={c} selected={on} onClick={() => set({ hidden: on ? [...s.hidden, c] : s.hidden.filter((x) => x !== c) })}>
                {CATEGORY_LABEL[c]}
              </Chip>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-1.5 font-semibold">Hidden outlets</p>
        {s.muted.length ? (
          <ul className="flex flex-wrap gap-2">
            {s.muted.map((m) => (
              <li key={m}>
                <Chip selected onClick={() => set({ muted: s.muted.filter((x) => x !== m) })}>
                  {m} <X size={12} aria-label={`Show ${m} again`} />
                </Chip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">None. Use “Hide” on a story to stop seeing an outlet.</p>
        )}
      </div>
      <p className="text-[12.5px] text-muted">Sources: The Guardian, GNews and Google News (when set up on the server), BBC News and NPR feeds. Weather from Open-Meteo; alerts from the U.S. National Weather Service.</p>
    </div>
  );
}
