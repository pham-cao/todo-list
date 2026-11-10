import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const { version } = JSON.parse(read("package.json"));

// Collect [file, ref] for every local reference.
const refs = [];
for (const m of read("index.html").matchAll(/\b(?:href|src)="([^"]*)"/g)) {
  if (m[1].startsWith("data:") || m[1].startsWith("#")) continue;
  refs.push(["index.html", m[1]]);
}
for (const f of readdirSync(new URL("src/", root)).filter((n) => n.endsWith(".js"))) {
  const code = read(`src/${f}`);
  const re = /\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)|\bimport\s+(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']|\bexport\s+[^"';]*?\sfrom\s+["']([^"']+)["']/g;
  for (const m of code.matchAll(re)) {
    const spec = m[1] || m[2] || m[3];
    if (/^\.{0,2}\//.test(spec)) refs.push([`src/${f}`, spec]);
  }
}

test("package.json version is set", () => assert.match(version, /^\d+\.\d+\.\d+$/));

test("every local reference carries the package version and names an existing file", () => {
  assert.ok(refs.length >= 4, "expected references to check");
  for (const [file, ref] of refs) {
    const [path, query] = ref.split("?");
    assert.equal(query, `v=${version}`, `${file}: ${ref}`);
    assert.ok(existsSync(new URL(path, new URL(file, root))), `${file}: missing file ${path}`);
  }
});
