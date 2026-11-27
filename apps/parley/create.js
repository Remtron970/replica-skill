// Remtron5000 Create: image and video generation with the leading cloud models,
// reached through fal.ai with the person's own API key (stored on this device only).
// Docs used: fal queue API (submit -> poll status_url -> fetch response_url, header "Authorization: Key <key>").

const QUEUE = "https://queue.fal.run/";

// Leading models as of November 2026 (LMArena / Artificial Analysis boards).
// Prices are rough estimates from public listings; fal.ai's model pages are the source of truth.
const GPT_SIZES = { "1:1": "square_hd", "16:9": "landscape_16_9", "9:16": "portrait_16_9", "4:3": "landscape_4_3", "3:4": "portrait_4_3" };

export const MODELS = {
  image: [
    {
      key: "gpt-image-2", name: "GPT Image 2", by: "OpenAI", badge: "Top of the leaderboards",
      endpoint: "openai/gpt-image-2", editEndpoint: "openai/gpt-image-2/edit",
      aspects: ["1:1", "16:9", "9:16", "4:3", "3:4"], maxCount: 4, perImage: 0.21,
      input: (o) => ({ prompt: o.prompt, image_size: GPT_SIZES[o.aspect] || "square_hd", quality: "high", num_images: o.count }),
      editInput: (o) => ({ prompt: o.prompt, image_urls: [o.ref], quality: "high", num_images: o.count }),
    },
    {
      key: "nano-banana-2", name: "Nano Banana 2", by: "Google", badge: "Great at edits and text",
      endpoint: "fal-ai/nano-banana-2", editEndpoint: "fal-ai/nano-banana-2/edit",
      aspects: ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9"], maxCount: 4, perImage: 0.08,
      input: (o) => ({ prompt: o.prompt, aspect_ratio: o.aspect, resolution: "1K", num_images: o.count }),
      editInput: (o) => ({ prompt: o.prompt, image_urls: [o.ref], num_images: o.count }),
    },
    {
      key: "seedream-5", name: "Seedream 5 Pro", by: "ByteDance", badge: "Photoreal, low cost",
      endpoint: "bytedance/seedream/v5/pro/text-to-image",
      aspects: null, maxCount: 1, perImage: 0.05,
      input: (o) => ({ prompt: o.prompt }),
    },
  ],
  video: [
    {
      key: "kling-3-pro", name: "Kling 3 Pro", by: "Kuaishou", badge: "#1 on blind-vote video boards",
      endpoint: "fal-ai/kling-video/v3/pro/text-to-video",
      aspects: ["16:9", "9:16", "1:1"], durations: [5, 10], audio: true, perSecond: 0.17,
      input: (o) => ({ prompt: o.prompt, duration: String(o.duration), aspect_ratio: o.aspect, generate_audio: o.audio }),
    },
    {
      key: "seedance-2", name: "Seedance 2.0", by: "ByteDance", badge: "Cinematic motion",
      endpoint: "bytedance/seedance-2.0/text-to-video",
      aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], durations: [5, 10], audio: true, perSecond: 0.3,
      input: (o) => ({ prompt: o.prompt, resolution: "720p", duration: String(o.duration), aspect_ratio: o.aspect, generate_audio: o.audio }),
    },
    {
      key: "veo-3.1", name: "Veo 3.1", by: "Google", badge: "Most polished, 8-second clips",
      endpoint: "fal-ai/veo3.1",
      aspects: ["16:9", "9:16"], durations: null, audio: true, perSecond: null,
      input: (o) => ({ prompt: o.prompt, aspect_ratio: o.aspect, resolution: "720p", generate_audio: o.audio }),
    },
  ],
};

const IMAGE_IDEAS = [
  "A cozy reading nook in a treehouse at golden hour, warm light, detailed",
  "Product photo of an orange camera on a marble table, soft studio lighting",
  "Watercolor map of an imaginary island with mountains and a lighthouse",
];
const VIDEO_IDEAS = [
  "Slow drone shot over a misty pine forest at sunrise",
  "A paper boat drifting down a rainy city gutter, close-up, cinematic",
  "Time-lapse of clouds rolling over a desert canyon",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const money = (n) => (n < 1 ? "$" + n.toFixed(2) : "$" + n.toFixed(2));

// ---------- fal.ai client ----------
async function falError(res) {
  let detail = "";
  try {
    const j = await res.json();
    const d = j.detail ?? j.error ?? j.message;
    detail = Array.isArray(d) ? d.map((x) => (x.loc ? x.loc.slice(1).join(".") + ": " : "") + (x.msg || JSON.stringify(x))).join("; ") : typeof d === "string" ? d : d ? JSON.stringify(d) : "";
  } catch { /* not JSON */ }
  if (res.status === 401 || res.status === 403) return new Error("fal.ai didn't accept your key. Check it on the Account page." + (detail ? " (" + detail + ")" : ""));
  if (res.status === 402 || /balance|credit|billing/i.test(detail)) return new Error("Your fal.ai account is out of credit. Add credit at fal.ai/dashboard/billing.");
  if (res.status === 422) return new Error("The model didn't accept these settings: " + (detail || "invalid input") + ". You can change the request under Advanced.");
  return new Error(`fal.ai error ${res.status}${detail ? ": " + detail : ""}`);
}

async function falFetch(url, key, init = {}) {
  try {
    return await fetch(url, { ...init, headers: { Authorization: "Key " + key, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) } });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error("Couldn't reach fal.ai. Check your internet connection.");
  }
}

async function falSubmit(endpoint, input, key) {
  const res = await falFetch(QUEUE + endpoint.replace(/^\/+/, ""), key, { method: "POST", body: JSON.stringify(input) });
  if (!res.ok) throw await falError(res);
  const j = await res.json();
  if (!j.status_url || !j.response_url) throw new Error("Unexpected reply from fal.ai.");
  return { statusUrl: j.status_url, responseUrl: j.response_url, requestId: j.request_id };
}

async function falWait(job, key, onStatus, signal) {
  const started = Date.now();
  let delay = 1200;
  while (true) {
    if (signal?.aborted) throw new DOMException("Stopped", "AbortError");
    const res = await falFetch(job.statusUrl, key);
    if (!res.ok && res.status !== 202) throw await falError(res);
    const s = await res.json().catch(() => ({}));
    onStatus?.(s.status, s.queue_position);
    if (s.status === "COMPLETED") break;
    if (Date.now() - started > 30 * 60 * 1000) throw new Error("This is taking longer than 30 minutes. It may still finish; reopen the app later.");
    await sleep(delay);
    delay = Math.min(delay * 1.3, 5000);
  }
  const out = await falFetch(job.responseUrl, key);
  if (!out.ok) throw await falError(out);
  return out.json();
}

function mediaFrom(result) {
  const r = result?.data ?? result ?? {};
  const urls = [];
  for (const k of ["images", "videos"]) if (Array.isArray(r[k])) for (const m of r[k]) if (m?.url) urls.push(m.url);
  for (const k of ["image", "video"]) if (r[k]?.url) urls.push(r[k].url);
  return urls;
}

// Shrink a photo before sending it (keeps uploads small and fast).
async function fileToDataUrl(file, max = 1536) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.9);
}

// ---------- UI ----------
export function initCreate({ store, dataKey, toast, openAccount }) {
  const $ = (id) => document.getElementById(id);
  const el = {
    view: $("createView"), prompt: $("cPrompt"), kindImage: $("cKindImage"), kindVideo: $("cKindVideo"),
    model: $("cModel"), modelNote: $("cModelNote"), aspects: $("cAspects"), aspectRow: $("cAspectRow"),
    countRow: $("cCountRow"), count: $("cCount"), durRow: $("cDurRow"), duration: $("cDuration"), audioRow: $("cAudioRow"), audio: $("cAudio"),
    refRow: $("cRefRow"), refInput: $("cRefInput"), refPreview: $("cRefPreview"), refImg: $("cRefImg"), refClear: $("cRefClear"),
    endpoint: $("cEndpoint"), extra: $("cExtra"), go: $("cGo"), cost: $("cCost"), gallery: $("cGallery"), empty: $("cEmpty"),
    noKey: $("cNoKey"), ideas: $("cIdeas"), viewer: $("viewer"),
  };
  const ui = { kind: "image", aspect: "1:1", ref: null, polling: new Set() };

  const key = () => store.get("falKey:" + dataKey(), "");
  const gallery = () => store.get("gallery:" + dataKey(), []);
  const saveGallery = (g) => store.set("gallery:" + dataKey(), g.slice(0, 200));
  const update = (id, patch) => { const g = gallery(); const it = g.find((x) => x.id === id); if (it) Object.assign(it, patch); saveGallery(g); renderGallery(); };
  const model = () => MODELS[ui.kind].find((m) => m.key === el.model.value) || MODELS[ui.kind][0];

  function setKind(kind) {
    ui.kind = kind;
    el.kindImage.setAttribute("aria-pressed", String(kind === "image"));
    el.kindVideo.setAttribute("aria-pressed", String(kind === "video"));
    el.view.dataset.kind = kind;
    el.model.innerHTML = "";
    for (const m of MODELS[kind]) el.model.add(new Option(`${m.name} · ${m.by}`, m.key));
    const saved = store.get("createModel:" + kind, null);
    if (saved && MODELS[kind].some((m) => m.key === saved)) el.model.value = saved;
    el.prompt.placeholder = kind === "image" ? "Describe the image you want…" : "Describe the video you want…";
    el.ideas.innerHTML = "";
    for (const idea of kind === "image" ? IMAGE_IDEAS : VIDEO_IDEAS) {
      const b = document.createElement("button"); b.type = "button"; b.className = "idea"; b.textContent = idea;
      b.onclick = () => { el.prompt.value = idea; refresh(); el.prompt.focus(); };
      el.ideas.appendChild(b);
    }
    onModel();
  }

  function onModel() {
    const m = model();
    store.set("createModel:" + ui.kind, m.key);
    el.modelNote.textContent = m.badge;
    // Aspect chips
    el.aspectRow.hidden = !m.aspects;
    el.aspects.innerHTML = "";
    if (m.aspects) {
      if (!m.aspects.includes(ui.aspect)) ui.aspect = m.aspects[0];
      for (const a of m.aspects) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "chip"; b.textContent = a;
        b.setAttribute("aria-pressed", String(a === ui.aspect));
        const [w, h] = a.split(":").map(Number);
        const shape = document.createElement("i"); shape.style.aspectRatio = `${w} / ${h}`; b.prepend(shape);
        b.onclick = () => { ui.aspect = a; onModel(); };
        el.aspects.appendChild(b);
      }
    }
    el.countRow.hidden = ui.kind !== "image" || m.maxCount < 2;
    el.durRow.hidden = ui.kind !== "video" || !m.durations;
    if (m.durations) {
      const cur = Number(el.duration.value) || m.durations[0];
      el.duration.innerHTML = "";
      for (const d of m.durations) el.duration.add(new Option(d + " seconds", d, false, d === cur));
    }
    el.audioRow.hidden = !m.audio;
    el.refRow.hidden = !m.editEndpoint;
    if (!m.editEndpoint) clearRef();
    el.endpoint.placeholder = ui.ref && m.editEndpoint ? m.editEndpoint : m.endpoint;
    refresh();
  }

  function estimate() {
    const m = model();
    if (ui.kind === "image") return m.perImage ? m.perImage * (el.countRow.hidden ? 1 : Number(el.count.value)) : null;
    if (!m.perSecond) return null;
    return m.perSecond * (m.durations ? Number(el.duration.value) : 8);
  }

  function refresh() {
    const hasKey = !!key();
    el.noKey.hidden = hasKey;
    const est = estimate();
    el.cost.textContent = est == null ? "price: see fal.ai" : "≈ " + money(est);
    el.go.disabled = !el.prompt.value.trim() || !hasKey;
    renderGallery();
  }

  function clearRef() { ui.ref = null; el.refPreview.hidden = true; el.refInput.value = ""; el.endpoint.placeholder = model().endpoint; }
  el.refInput.addEventListener("change", async () => {
    const f = el.refInput.files?.[0];
    if (!f) return;
    try {
      ui.ref = await fileToDataUrl(f);
      el.refImg.src = ui.ref;
      el.refPreview.hidden = false;
      el.endpoint.placeholder = model().editEndpoint;
    } catch { toast("Couldn't read that photo"); }
  });
  el.refClear.addEventListener("click", clearRef);

  async function generate() {
    const k = key();
    const prompt = el.prompt.value.trim();
    if (!k || !prompt) return;
    const m = model();
    const opts = { prompt, aspect: ui.aspect, count: Number(el.count.value) || 1, duration: Number(el.duration.value) || 5, audio: el.audio.checked, ref: ui.ref };
    const editing = !!(ui.ref && m.editEndpoint);
    const endpoint = el.endpoint.value.trim() || (editing ? m.editEndpoint : m.endpoint);
    let input = editing ? m.editInput(opts) : m.input(opts);
    if (el.extra.value.trim()) {
      try { input = { ...input, ...JSON.parse(el.extra.value) }; }
      catch { toast("Advanced options must be valid JSON"); return; }
    }
    const item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind: ui.kind, model: m.name, endpoint, prompt,
      aspect: m.aspects ? ui.aspect : null, edited: editing, createdAt: Date.now(), status: "submitting", urls: [],
    };
    saveGallery([item, ...gallery()]);
    renderGallery();
    el.go.classList.add("launch"); setTimeout(() => el.go.classList.remove("launch"), 600);
    if (matchMedia("(max-width: 760px)").matches) el.gallery.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const job = await falSubmit(endpoint, input, k);
      update(item.id, { status: "IN_QUEUE", statusUrl: job.statusUrl, responseUrl: job.responseUrl });
      poll(item.id);
    } catch (err) {
      update(item.id, { status: "error", error: err.message });
    }
  }

  async function poll(id) {
    if (ui.polling.has(id)) return;
    const it = gallery().find((x) => x.id === id);
    if (!it?.statusUrl) return;
    ui.polling.add(id);
    const owner = dataKey();
    try {
      const result = await falWait(it, key(), (status, pos) => {
        if (dataKey() !== owner) return;
        update(id, { status: status || "IN_PROGRESS", queuePos: pos ?? null });
      });
      const urls = mediaFrom(result);
      if (dataKey() !== owner) return;
      if (!urls.length) update(id, { status: "error", error: "The model finished but returned no media. It may have been blocked by the model's safety filter." });
      else { update(id, { status: "done", urls, doneAt: Date.now() }); toast(it.kind === "video" ? "Your video is ready 🎬" : "Your image is ready ✨"); }
    } catch (err) {
      if (dataKey() === owner) update(id, { status: "error", error: err.message });
    } finally {
      ui.polling.delete(id);
    }
  }

  function resumePending() {
    for (const it of gallery()) if (it.statusUrl && !["done", "error"].includes(it.status)) poll(it.id);
  }

  function statusText(it) {
    const secs = Math.round((Date.now() - it.createdAt) / 1000);
    const t = secs < 60 ? secs + "s" : Math.floor(secs / 60) + "m " + (secs % 60) + "s";
    if (it.status === "submitting") return "Sending…";
    if (it.status === "IN_QUEUE") return (it.queuePos ? `In line (#${it.queuePos + 1})` : "In line") + " · " + t;
    return (it.kind === "video" ? "Filming" : "Painting") + "… " + t;
  }

  let ticker = 0;
  function renderGallery() {
    const items = gallery();
    el.empty.hidden = items.length > 0;
    el.gallery.innerHTML = "";
    let pending = false;
    for (const it of items) {
      const card = document.createElement("figure");
      card.className = "g-card " + (it.status === "done" ? "done" : it.status === "error" ? "error" : "pending");
      if (it.aspect) { const [w, h] = it.aspect.split(":").map(Number); card.style.setProperty("--ar", `${w} / ${h}`); }
      const media = document.createElement("div"); media.className = "g-media";
      if (it.status === "done") {
        const url = it.urls[0];
        if (it.kind === "video") {
          const v = document.createElement("video"); v.src = url; v.muted = true; v.loop = true; v.playsInline = true; v.preload = "metadata";
          media.onmouseenter = () => v.play().catch(() => {}); media.onmouseleave = () => v.pause();
          media.appendChild(v);
          const play = document.createElement("span"); play.className = "g-play"; play.textContent = "▶"; media.appendChild(play);
        } else {
          const img = document.createElement("img"); img.src = url; img.alt = it.prompt; img.loading = "lazy"; media.appendChild(img);
        }
        if (it.urls.length > 1) { const n = document.createElement("span"); n.className = "g-count"; n.textContent = "×" + it.urls.length; media.appendChild(n); }
        media.tabIndex = 0; media.setAttribute("role", "button"); media.setAttribute("aria-label", "Open " + it.prompt);
        media.onclick = () => openViewer(it.id);
        media.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openViewer(it.id); } };
      } else if (it.status === "error") {
        const p = document.createElement("p"); p.textContent = "⚠ " + it.error; media.appendChild(p);
      } else {
        pending = true;
        const s = document.createElement("div"); s.className = "g-status"; s.textContent = statusText(it); media.appendChild(s);
      }
      const cap = document.createElement("figcaption");
      const pr = document.createElement("span"); pr.className = "g-prompt"; pr.textContent = it.prompt;
      const meta = document.createElement("span"); meta.className = "g-meta"; meta.textContent = it.model + (it.edited ? " · edit" : "");
      cap.append(pr, meta);
      if (it.status === "error") {
        const x = document.createElement("button"); x.type = "button"; x.className = "g-remove"; x.textContent = "Remove";
        x.onclick = () => { saveGallery(gallery().filter((g) => g.id !== it.id)); renderGallery(); };
        cap.appendChild(x);
      }
      card.append(media, cap);
      el.gallery.appendChild(card);
    }
    clearTimeout(ticker);
    if (pending && !el.view.hidden) ticker = setTimeout(renderGallery, 1000);
  }

  // Viewer
  let viewing = null;
  function openViewer(id) {
    const it = gallery().find((x) => x.id === id);
    if (!it) return;
    viewing = it;
    const box = $("vMedia"); box.innerHTML = "";
    for (const url of it.urls) {
      if (it.kind === "video") { const v = document.createElement("video"); v.src = url; v.controls = true; v.autoplay = true; v.loop = true; v.playsInline = true; box.appendChild(v); }
      else { const img = document.createElement("img"); img.src = url; img.alt = it.prompt; box.appendChild(img); }
    }
    $("vPrompt").textContent = it.prompt;
    $("vMeta").textContent = `${it.model}${it.edited ? " · edit" : ""} · ${new Date(it.createdAt).toLocaleString()}`;
    el.viewer.showModal();
  }
  $("vClose").addEventListener("click", () => el.viewer.close());
  el.viewer.addEventListener("close", () => { $("vMedia").innerHTML = ""; });
  $("vReuse").addEventListener("click", () => { el.prompt.value = viewing.prompt; el.viewer.close(); refresh(); el.prompt.focus(); });
  $("vDelete").addEventListener("click", () => {
    if (!confirm("Remove this from your gallery?")) return;
    saveGallery(gallery().filter((g) => g.id !== viewing.id)); el.viewer.close(); renderGallery();
  });
  $("vSave").addEventListener("click", async () => {
    const url = viewing.urls[0];
    const ext = viewing.kind === "video" ? "mp4" : (url.match(/\.(png|jpe?g|webp)(\?|$)/i)?.[1] || "png");
    const name = `remtron5000-${viewing.id}.${ext}`;
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], name, { type: blob.type });
      if (navigator.canShare?.({ files: [file] }) && /iphone|ipad|android/i.test(navigator.userAgent)) { await navigator.share({ files: [file] }); return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (err) {
      if (err.name !== "AbortError") window.open(url, "_blank", "noopener");
    }
  });

  // Wiring
  el.kindImage.addEventListener("click", () => setKind("image"));
  el.kindVideo.addEventListener("click", () => setKind("video"));
  el.model.addEventListener("change", onModel);
  el.prompt.addEventListener("input", refresh);
  el.count.addEventListener("change", refresh);
  el.duration.addEventListener("change", refresh);
  el.prompt.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); generate(); } });
  el.go.addEventListener("click", generate);
  $("cAddKey").addEventListener("click", () => openAccount("key"));

  setKind("image");

  return {
    // Called when the signed-in person changes or the view is shown.
    refresh() { refresh(); resumePending(); },
    hasKey: () => !!key(),
  };
}
