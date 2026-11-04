// Bundles each test with esbuild (so src/ can use normal TS and extensionless imports), then runs node --test.
import esbuild from "esbuild";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const files = fs.readdirSync("test").filter((f) => f.endsWith(".test.ts")).map((f) => `test/${f}`);
fs.rmSync(".test-build", { recursive: true, force: true });
await esbuild.build({
  entryPoints: files,
  bundle: true,
  platform: "node",
  format: "esm",
  outdir: ".test-build",
  outExtension: { ".js": ".mjs" },
  packages: "external",
  logLevel: "warning",
});
const out = files.map((f) => `.test-build/${f.slice(5).replace(/\.ts$/, ".mjs")}`);
const r = spawnSync(process.execPath, ["--test", ...out], { stdio: "inherit" });
process.exit(r.status ?? 1);
