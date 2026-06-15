import { defineConfig } from "tsup";

export default defineConfig([
  // npm package: ESM + CJS with type declarations.
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
  },
  // CDN / <script> drop-in: a single minified IIFE exposing `window.dpdpstack`.
  {
    entry: { dpdpstack: "src/index.ts" },
    format: ["iife"],
    globalName: "dpdpstack",
    minify: true,
    sourcemap: true,
  },
]);
