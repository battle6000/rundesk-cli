import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The console's build.
 *
 * Its output is committed and shipped, which is the whole reason an install needs no Node
 * and no build step. That also makes every setting here a question about what a reviewer
 * can see and what two machines will agree on, rather than about bytes over a wire — there
 * is no wire. It is served over loopback by a command somebody explicitly started.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(here, "src") } },

  // Relative asset URLs, so the built page works whatever path it is mounted at and
  // cannot break if that ever changes. Costs nothing, removes a class of bug.
  base: "./",

  build: {
    outDir: path.resolve(here, "../src/ui/dist"),
    // Required, because the output is outside this project's root and Vite will not
    // empty such a directory unless told. It is also what makes a chunk that stops
    // being built disappear from the committed tree instead of lingering as an orphan.
    emptyOutDir: true,
    // Source maps carry absolute paths, so two machines building the same commit would
    // produce different bytes — and "the committed bundle is what the source builds" is
    // asserted by comparing exactly those bytes.
    sourcemap: false,
    target: "es2022",
    cssCodeSplit: false,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // **Fixed names, no content hash.** A hashed name turns every change into "one
        // file deleted, one file added", and a reviewer looking at that sees nothing.
        // The cost is cache-busting, and the server answers `no-store` on these for the
        // same reason — a browser holding yesterday's bundle after an update reads as a
        // console that is broken and cannot be fixed by reinstalling.
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },

  server: {
    port: 5178,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:7357",
        changeOrigin: false,
        // The console refuses a request whose `Host` is not the one it bound, which is
        // its defence against a name pointed at loopback. In development the browser is
        // on another port, so the proxy has to present itself as the console's own
        // address or every request is refused — correctly.
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("host", "127.0.0.1:7357");
            proxyReq.setHeader("origin", "http://127.0.0.1:7357");
          });
        },
      },
    },
  },
});
