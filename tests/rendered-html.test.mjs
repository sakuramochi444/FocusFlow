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
  assert.match(dashboard, /type FocusSession/);
  assert.match(dashboard, /focusSessions/);
  assert.match(dashboard, /buildWeekStats\(focusSessions\)/);
  assert.match(dashboard, /最近の記録/);
  assert.match(dashboard, /timerEndsAt/);
  assert.match(dashboard, /notifyUser/);
  assert.match(dashboard, /function SettingsModal/);
  assert.match(dashboard, /function OnboardingModal/);
  assert.match(dashboard, /function AuthModal/);
  assert.match(dashboard, /authRequired/);
  assert.match(dashboard, /required \? "signup" : "signin"/);
  assert.match(dashboard, /作業環境を読み込んでいます/);
  assert.match(dashboard, /onboardingComplete/);
  assert.match(dashboard, /初期設定を保存しました/);
  assert.match(dashboard, /visible:\s*VisibleSections/);
  assert.match(dashboard, /バックアップを書き出す/);
  assert.match(dashboard, /ホームに表示する項目/);
  assert.match(dashboard, /const INITIAL_TASKS: Task\[\] = \[\]/);
  assert.match(dashboard, /const deleteTask =/);
  assert.match(dashboard, /task-delete/);
  assert.match(dashboard, /タスクはまだありません/);
});

test("ships PWA manifest and service worker assets", async () => {
  const [layout, register, manifestRaw, worker, offline] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pwa-register.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../public/offline.html", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(register, /serviceWorker\.register\("\/sw\.js"/);
  assert.match(worker, /CACHE_NAME = "focusflow-pwa-v1"/);
  assert.match(worker, /networkFirst\(request, "\/offline\.html"\)/);
  assert.match(worker, /notificationclick/);
  assert.match(offline, /オフラインです/);
});

test("defines account database and sync API routes", async () => {
  const [hosting, schema, authRoute, syncRoute, authStore, requestEnv, worker, viteConfig, wranglerConfig, migration, packagedMigration, packageJson, packageScript] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/sync/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/_lib/auth-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/_lib/request-env.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../dist/server/wrangler.json", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0000_zippy_starfox.sql", import.meta.url), "utf8"),
    readFile(new URL("../dist/server/migrations/0000_zippy_starfox.sql", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/package-d1-migrations.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(schema, /users = sqliteTable/);
  assert.match(schema, /authSessions = sqliteTable/);
  assert.match(schema, /userAppStates = sqliteTable/);
  assert.match(authRoute, /hashPassword/);
  assert.match(syncRoute, /getCurrentUser/);
  assert.match(authStore, /getFocusFlowEnv/);
  assert.match(requestEnv, /AsyncLocalStorage/);
  assert.match(worker, /runWithFocusFlowEnv/);
  assert.match(viteConfig, /name: "focusflow"/);
  assert.match(wranglerConfig, /"name":"focusflow"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `users`/);
  assert.match(packagedMigration, /CREATE TABLE IF NOT EXISTS `users`/);
  assert.match(packageJson, /package-d1-migrations\.mjs/);
  assert.match(packageJson, /wrangler deploy --name focusflow --config dist\/server\/wrangler\.json/);
  assert.match(packageScript, /dist", "server", "migrations"/);
});
