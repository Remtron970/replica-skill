// Free, on-device image generation with Janus-Pro 1B (DeepSeek) on WebGPU via Transformers.js.
// Runs in a background thread. The model downloads once (about 1-2 GB) and is cached by the browser.
import { AutoProcessor, MultiModalityCausalLM } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2";

const DEFAULT_MODEL = "onnx-community/Janus-Pro-1B-ONNX";
let loadedId = null;
let processor = null;
let model = null;

async function load(modelId) {
  if (loadedId === modelId && model) return;
  // Report download progress as a single overall fraction.
  const files = new Map();
  const progress_callback = (p) => {
    if (p.status === "progress" && p.total) {
      files.set(p.file, [p.loaded, p.total]);
      let done = 0, total = 0;
      for (const [l, t] of files.values()) { done += l; total += t; }
      self.postMessage({ type: "loading", fraction: total ? done / total : 0, text: "Downloading the free image model (first time only)…" });
    }
  };
  processor = await AutoProcessor.from_pretrained(modelId, { progress_callback });
  model = await MultiModalityCausalLM.from_pretrained(modelId, {
    dtype: { prepare_inputs_embeds: "q4", language_model: "q4f16", lm_head: "fp16", gen_head: "fp16", gen_img_embeds: "fp16", image_decode: "fp32" },
    device: { prepare_inputs_embeds: "wasm", language_model: "webgpu", lm_head: "webgpu", gen_head: "webgpu", gen_img_embeds: "webgpu", image_decode: "webgpu" },
    progress_callback,
  });
  loadedId = modelId;
}

self.onmessage = async ({ data }) => {
  if (data.type !== "generate") return;
  const { id, prompt } = data;
  try {
    if (!("gpu" in navigator)) throw new Error("This device's browser has no WebGPU, which the free on-device model needs. Try Chrome or Edge on a computer, or use the free cloud model.");
    await load(data.modelId || DEFAULT_MODEL);
    self.postMessage({ type: "loading", fraction: null, text: "Painting on your device…" });

    const inputs = await processor([{ role: "<|User|>", content: prompt }], { chat_template: "text_to_image" });
    const n = processor.num_image_tokens;
    let made = 0;
    // Minimal streamer: called once per generated token, so we can show real progress.
    const streamer = {
      put() { made++; if (made % 8 === 0) self.postMessage({ type: "progress", id, fraction: Math.min(1, made / n) }); },
      end() {},
    };
    const images = await model.generate_images({ ...inputs, min_new_tokens: n, max_new_tokens: n, do_sample: true, streamer });
    const blob = await images[0].toBlob("image/png");
    self.postMessage({ type: "done", id, blob });
  } catch (err) {
    self.postMessage({ type: "error", id, message: String(err?.message || err) });
  }
};
