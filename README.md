# Remtron5000: free AI chat

Remtron5000 is a ChatGPT-style chat assistant you can use for free. There's no
account, no API key, no server and no monthly bill. The AI model runs **on your
own device**, so your conversations never leave your browser. The optional
Create tab adds image and video generation through fal.ai with your own key.

It is an original app built with the Replica skills, clean-room style. It
copies how a chat assistant works, but not anyone's code, branding or text.

## Features

- Chat with streamed answers, rendered as Markdown, with code blocks and a copy button
- Stop a response, regenerate the last answer, edit and resend your message
- A chat history sidebar grouped by date, with search, rename and delete
- Choice of 8 open-source models, from tiny (0.3 GB) to smarter (2 GB)
- **Create tab:** images and videos from the leading cloud models (GPT Image 2,
  Nano Banana 2, Seedream 5 Pro, Kling 3 Pro, Seedance 2.0, Veo 3.1) through
  [fal.ai](https://fal.ai), using your own fal.ai key, plus photo editing, a gallery,
  and a full-screen viewer with save. See "Image and video generation" below.
- Custom instructions (system prompt) and temperature
- An orange theme with animations, light and dark mode, and a layout that works on phones
- An Account page: create an account, sign in and out, choose an avatar color,
  change your password, delete your account. Each account has its own chats.
  Accounts live on the device only (no server), so they don't sync between devices.
- History saved in your browser (localStorage)

## Run it

It's a static site, so you only need a file server:

```bash
cd apps/parley
python3 -m http.server 8000
# open http://localhost:8000
```

To put it online for free, upload the `apps/parley` folder to any static host
(GitHub Pages, Netlify, Cloudflare Pages or Vercel).

## Install it as an app

Remtron5000 is a Progressive Web App (PWA). It gets its own icon and window and works
offline. It doesn't need an app store. Once it's online (or on `localhost`), you
can install it:

| Device | How |
| --- | --- |
| Windows, Mac, Linux (Chrome or Edge) | Click **Install app** in the sidebar, or the install icon in the address bar |
| Android (Chrome) | Tap **Install app** in the sidebar, or menu ⋮ and then **Install app** |
| iPhone or iPad (Safari) | Tap Share, then **Add to Home Screen** (the sidebar button shows these steps) |
| Mac (Safari) | File, then **Add to Dock** |

Installing needs HTTPS (or `localhost`). Every host listed above gives you
HTTPS for free. After the first run, the app and the model you chose are
cached, so Remtron5000 opens and chats with no internet connection. Long-pressing or
right-clicking the icon gives you a **New chat** shortcut.

Want it in the Play Store or App Store later? The same folder can be wrapped
with [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) (Play Store)
or [Capacitor](https://capacitorjs.com) (both stores).

## Two free engines

**1. In-browser (default).** Uses [WebLLM](https://github.com/mlc-ai/web-llm)
on WebGPU. It needs a recent Chrome or Edge on desktop, or Safari 26 or newer.
On your first message it downloads the model once (about 0.3–2 GB) and caches
it, so after that it starts fast and works offline. A laptop with 8 GB of RAM
handles the 1–1.5B models well.

**2. Ollama.** Use this for bigger and smarter models, or for browsers without
WebGPU. Install [Ollama](https://ollama.com), then run:

```bash
ollama pull llama3.2        # or qwen2.5:7b, mistral, gemma2 …
```

Then open Settings, set Engine to Ollama, and pick the model from the menu at
the top. If you host Remtron5000 somewhere other than `localhost`, allow that origin
with `OLLAMA_ORIGINS=https://your-site.example ollama serve`.

## Image and video generation

Chat stays free and runs on your device. The **Create** tab uses paid cloud
models, which no phone can run, so it needs your own [fal.ai](https://fal.ai) API key:

1. Make an account at fal.ai, add some credit, and create a key at
   <https://fal.ai/dashboard/keys>.
2. In Remtron5000, open **Account**, go to **Image & video generation**, paste the key, and tap **Save key**.
3. Switch to **🎨 Create**, then pick Image or Video, a model and a shape, and tap **Generate**.

| Kind | Model | fal.ai model ID | Rough cost |
| --- | --- | --- | --- |
| Image | GPT Image 2 (OpenAI) | `openai/gpt-image-2` (edit: `/edit`) | up to ~$0.21 per image at high quality |
| Image | Nano Banana 2 (Google) | `fal-ai/nano-banana-2` (edit: `/edit`) | ~$0.08 per image |
| Image | Seedream 5 Pro (ByteDance) | `bytedance/seedream/v5/pro/text-to-image` | ~$0.05 per image |
| Video | Kling 3 Pro (Kuaishou) | `fal-ai/kling-video/v3/pro/text-to-video` | ~$0.11–0.17 per second |
| Video | Seedance 2.0 (ByteDance) | `bytedance/seedance-2.0/text-to-video` | ~$0.30 per second at 720p |
| Video | Veo 3.1 (Google) | `fal-ai/veo3.1` | see fal.ai |

Prices are estimates from public listings in November 2026. fal.ai's model pages
are the real price list. Leaderboards change often, so **Advanced** in the Create
panel accepts any fal.ai model ID and extra JSON options. That lets you try a
newer model without changing the code; update `MODELS` in `create.js` to make it
a default.

Your key is stored on your device and sent only to fal.ai. Anyone with access to
your unlocked device and browser could read it, so set a spending limit in your
fal.ai dashboard. fal.ai's file links may not last forever, so use **Save** on the
creations you want to keep.

## Files

```
index.html   layout
styles.css   design tokens (light and dark) and components
app.js       storage, accounts, engines (WebLLM, Ollama), streaming, UI, install button
create.js    Create tab: fal.ai queue client, model list, gallery, viewer
manifest.webmanifest   app name, icons, colours, shortcut
sw.js        service worker: offline app shell + cached engine script
icons/       app icon (SVG source + PNGs, including maskable and Apple touch)
vendor/      marked (Markdown) and DOMPurify (HTML sanitizer), MIT and Apache-2.0
```

## Honest limits

Free local models are much smaller than paid cloud models. They are good for
writing, explaining, brainstorming and simple code, but weaker at hard
reasoning, and they can get facts wrong. They can't browse the web or make
images. With Ollama on a strong computer, a 7–8B model narrows the gap a lot.
