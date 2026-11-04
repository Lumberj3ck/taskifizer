// Builds dist/preview.html: the real plugin view and styles running in a mock Obsidian window.
import esbuild from "esbuild";
import fs from "node:fs";

const result = await esbuild.build({
  entryPoints: ["preview/preview.ts"],
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: true,
  write: false,
  alias: { obsidian: "./preview/obsidian-shim.ts" },
  logLevel: "warning",
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = fs.readFileSync("styles.css", "utf8");
const html = fs
  .readFileSync("preview/template.html", "utf8")
  .replace("/*PLUGIN_CSS*/", () => css)
  .replace("//PREVIEW_JS", () => js);

fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/preview.html", html);
console.log(`dist/preview.html (${(html.length / 1024).toFixed(0)} KB)`);
