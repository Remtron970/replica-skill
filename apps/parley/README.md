# Parley: free AI chat

Parley is a ChatGPT-style chat assistant you can use for free. There's no
account, no API key, no server and no monthly bill. The AI model runs **on your
own device**, so your conversations never leave your browser.

It is an original app built with the Replica skills, clean-room style. It
copies how a chat assistant works, but not anyone's code, branding or text.

## Features

- Chat with streamed answers, rendered as Markdown, with code blocks and a copy button
- Stop a response, regenerate the last answer, edit and resend your message
- A chat history sidebar grouped by date, with search, rename and delete
- Choice of 8 open-source models, from tiny (0.3 GB) to smarter (2 GB)
- Custom instructions (system prompt) and temperature
- Light and dark mode, and a layout that works on phones
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
the top. If you host Parley somewhere other than `localhost`, allow that origin
with `OLLAMA_ORIGINS=https://your-site.example ollama serve`.

## Files

```
index.html   layout
styles.css   design tokens (light and dark) and components
app.js       storage, engines (WebLLM, Ollama), streaming, UI
vendor/      marked (Markdown) and DOMPurify (HTML sanitizer), MIT and Apache-2.0
```

## Honest limits

Free local models are much smaller than paid cloud models. They are good for
writing, explaining, brainstorming and simple code, but weaker at hard
reasoning, and they can get facts wrong. They can't browse the web or make
images. With Ollama on a strong computer, a 7–8B model narrows the gap a lot.
