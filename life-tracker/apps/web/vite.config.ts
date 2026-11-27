import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative base so the build works from any folder or static host.
  base: "./",
  plugins: [react(), tailwindcss()],
  server: { host: true, port: 5173 },
});
