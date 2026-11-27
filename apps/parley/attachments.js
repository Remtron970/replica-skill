// Reading files and photos people attach to a chat message.

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|jsonl|xml|html?|css|js|mjs|cjs|ts|tsx|jsx|py|rb|go|rs|java|kt|swift|c|h|cpp|hpp|cs|php|sh|bash|zsh|sql|ya?ml|toml|ini|cfg|conf|log|env|tex|rtf|srt|vtt)$/i;

export const MAX_FILES = 6;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function kindOf(file) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  if (file.type.startsWith("text/") || TEXT_EXT.test(file.name) || /json|xml|javascript|csv/.test(file.type)) return "text";
  return null;
}

// Shrinks photos so they're quick to send and small to store.
export async function readImage(file, max = 1280) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

let pdfjs = null;
async function readPdf(file) {
  if (!pdfjs) {
    pdfjs = await import("./vendor/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.mjs", import.meta.url).href;
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let i = 1; i <= Math.min(doc.numPages, 200); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it) => it.str + (it.hasEOL ? "\n" : " ")).join("").trim());
  }
  const text = pages.filter(Boolean).map((t, i) => `--- Page ${i + 1} ---\n${t}`).join("\n\n");
  if (!text.trim()) throw new Error("This PDF has no selectable text (it may be scanned pictures of pages).");
  return text;
}

export async function readText(file) {
  return kindOf(file) === "pdf" ? readPdf(file) : file.text();
}

// Fit file text into what the model can read at once, keeping the start of the file.
export function clip(text, maxChars) {
  if (text.length <= maxChars) return { text, clipped: false };
  return { text: text.slice(0, maxChars), clipped: true };
}

export function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export function fileIcon(name) {
  if (/\.pdf$/i.test(name)) return "📕";
  if (/\.(csv|tsv|xlsx?)$/i.test(name)) return "📊";
  if (/\.(js|ts|py|rb|go|rs|java|c|cpp|cs|php|sh|sql|html?|css|json|ya?ml|tsx|jsx|swift|kt)$/i.test(name)) return "🧩";
  return "📄";
}
