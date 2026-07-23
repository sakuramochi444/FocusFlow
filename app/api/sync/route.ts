import { NextResponse } from "next/server";
import { ensureSchema, getCurrentUser, getD1 } from "../_lib/auth-store";

const MAX_PAYLOAD_BYTES = 500_000;

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  await ensureSchema();
  const db = await getD1();
  const row = await db
    .prepare("SELECT payload, updated_at as updatedAt FROM user_app_states WHERE user_id = ?")
    .bind(user.id)
    .first<{ payload: string; updatedAt: string }>();

  return NextResponse.json({
    user,
    state: row ? JSON.parse(row.payload) : null,
    updatedAt: row?.updatedAt ?? null,
  });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const state = await request.json().catch(() => null);
  if (!state || typeof state !== "object") {
    return NextResponse.json({ error: "保存データを確認してください" }, { status: 400 });
  }

  const payload = JSON.stringify(state);
  if (new TextEncoder().encode(payload).byteLength > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "保存データが大きすぎます" }, { status: 413 });
  }

  await ensureSchema();
  const now = new Date().toISOString();
  const db = await getD1();
  await db
    .prepare(
      "INSERT INTO user_app_states (user_id, payload, version, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, version = user_app_states.version + 1, updated_at = excluded.updated_at",
    )
    .bind(user.id, payload, now)
    .run();

  return NextResponse.json({ ok: true, updatedAt: now });
}
