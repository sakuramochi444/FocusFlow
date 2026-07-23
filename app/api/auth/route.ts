import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  createSession,
  ensureSchema,
  getCurrentUser,
  getD1,
  getSessionToken,
  hashPassword,
  hashToken,
  sessionCookie,
} from "../_lib/auth-store";

type AuthPayload = {
  mode?: "signin" | "signup" | "logout";
  email?: string;
  name?: string;
  password?: string;
};

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({} as AuthPayload));
    const mode = payload.mode ?? "signin";

    if (mode === "logout") {
      const token = getSessionToken(request);
      if (token) {
        try {
          await ensureSchema();
          const db = await getD1();
          await db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await hashToken(token)).run();
        } catch { /* Always clear the browser session even if the remote session cleanup fails. */ }
      }
      return NextResponse.json({ user: null }, { headers: { "Set-Cookie": clearSessionCookie() } });
    }

    const email = payload.email?.trim().toLowerCase() ?? "";
    const password = payload.password ?? "";
    const name = payload.name?.trim() || email.split("@")[0] || "FocusFlow User";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "メールアドレスを確認してください" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "パスワードは8文字以上にしてください" }, { status: 400 });
    }

    await ensureSchema();

    if (mode === "signup") {
      const now = new Date().toISOString();
      const passwordData = await hashPassword(password);
      const userId = crypto.randomUUID();
      const db = await getD1();
      await db
        .prepare("INSERT INTO users (id, email, name, password_hash, password_salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(userId, email, name, passwordData.hash, passwordData.salt, now, now)
        .run();
      const token = await createSession(userId);
      return NextResponse.json({ user: { id: userId, email, name } }, { headers: { "Set-Cookie": sessionCookie(token) } });
    }

    const db = await getD1();
    const user = await db
      .prepare("SELECT id, email, name, password_hash as passwordHash, password_salt as passwordSalt FROM users WHERE email = ?")
      .bind(email)
      .first<{ id: string; email: string; name: string; passwordHash: string; passwordSalt: string }>();
    if (!user) return NextResponse.json({ error: "メールアドレスまたはパスワードが違います" }, { status: 401 });

    const passwordData = await hashPassword(password, user.passwordSalt);
    if (passwordData.hash !== user.passwordHash) {
      return NextResponse.json({ error: "メールアドレスまたはパスワードが違います" }, { status: 401 });
    }

    const token = await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } }, { headers: { "Set-Cookie": sessionCookie(token) } });
  } catch (error) {
    if (error instanceof Error && /UNIQUE|constraint/i.test(error.message)) {
      return NextResponse.json({ error: "このメールアドレスはすでに登録されています" }, { status: 409 });
    }
    return NextResponse.json({ error: "認証データベースに接続できませんでした。D1の設定とマイグレーションを確認してください。" }, { status: 503 });
  }
}
