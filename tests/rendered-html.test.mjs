import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the FocusFlow application", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /FocusFlow/);
  assert.match(html, /<title>FocusFlow/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("keeps personal data local and provides configurable sections", async () => {
  const dashboard = await readFile(new URL("../app/focus-dashboard.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /localStorage\.setItem\("focusflow-state"/);
  assert.match(dashboard, /function SettingsModal/);
  assert.match(dashboard, /function OnboardingModal/);
  assert.match(dashboard, /onboardingComplete/);
  assert.match(dashboard, /初期設定を保存しました/);
  assert.match(dashboard, /visible:\s*VisibleSections/);
  assert.match(dashboard, /バックアップを書き出す/);
  assert.match(dashboard, /ホームに表示する項目/);
});
