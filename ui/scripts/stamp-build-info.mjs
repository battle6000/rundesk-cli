/**
 * Write what the built console was built from, beside the built console.
 *
 * The output in `../src/ui/dist` is committed, which is what lets an install need no Node
 * and no build step. It is also two ways to be wrong, and they need different detectors:
 *
 *   - **stale** — somebody changed `ui/` and did not rebuild, so what ships does not
 *     match its source. Nothing looks broken; it is just the wrong console.
 *   - **tampered** — somebody edited the minified bundle directly to fix something
 *     quickly. The source can then never reproduce it, and the next honest build
 *     silently reverts the fix.
 *
 * `sources_sha256` catches the first and the per-file hashes catch the second, and
 * `tests/test_ui.py` checks both with no Node installed — which matters, because the
 * people who work on this repo are Python contributors.
 *
 * **No timestamp and no git SHA.** Either would change this file on every build and
 * destroy the one property the CI check rests on: build the same commit twice, get the
 * same bytes. This is the one place where recording when something happened is wrong.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(here, "..");
const dist = path.resolve(workspace, "../src/ui/dist");

/** What is the workspace's machinery rather than its source. */
const NOT_SOURCE = new Set(["node_modules", "dist", ".vite", ".git"]);

function walked(root, within = "") {
  const found = [];
  for (const entry of readdirSync(path.join(root, within), { withFileTypes: true })) {
    const at = within ? `${within}/${entry.name}` : entry.name;
    if (NOT_SOURCE.has(entry.name) || entry.name.startsWith(".env")) continue;
    if (entry.isDirectory()) found.push(...walked(root, at));
    else if (entry.isFile()) found.push(at);
  }
  return found;
}

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Sorted, and each entry carries its own path: two different files swapping names would
// otherwise hash the same, and so would a file that moved.
const sources = walked(workspace).sort();
const sourcesHash = sha(
  sources.map((at) => `${at}\0${sha(readFileSync(path.join(workspace, at)))}\n`).join(""),
);

const files = {};
for (const at of walked(dist).sort()) {
  if (at === "build-info.json") continue;
  files[at] = `sha256:${sha(readFileSync(path.join(dist, at)))}`;
}

const version = JSON.parse(
  readFileSync(path.resolve(workspace, "../src/rundesk/__init__.py"), "utf8")
    .match(/__version__ = "([^"]+)"/)
    ?.slice(1, 2)
    ?.map((one) => JSON.stringify(one))[0] ?? '"unknown"',
);

writeFileSync(
  path.join(dist, "build-info.json"),
  JSON.stringify({ ui_version: version, sources_sha256: sourcesHash, files }, null, 2) + "\n",
);

const measured = statSync(path.join(dist, "assets/app.js")).size;
console.log(
  `stamped ${Object.keys(files).length} files, ${(measured / 1024).toFixed(0)} kB of script`,
);
