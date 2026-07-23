export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

const SESSION_COOKIE = "focusflow_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function sessionCookieName() {
  return SESSION_COOKIE;
}

export function sessionCookie(value: string, maxAge = SESSION_MAX_AGE_SECONDS) {
  const parts = [
    `${SESSION_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie() {
  return sessionCookie("", 0);
}

export function getSessionToken(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1) ?? null;
}

export async function getD1() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("D1 binding DB is unavailable.");
  return env.DB;
}

export async function ensureSchema() {
  const db = await getD1();
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS user_app_states (user_id TEXT PRIMARY KEY, payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS auth_sessions_token_hash_idx ON auth_sessions (token_hash)"),
    db.prepare("CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions (user_id)"),
  ]);
}

export async function hashPassword(password: string, salt = randomToken(24)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 120000 },
    key,
    256,
  );
  return { salt, hash: bufferToBase64(bits) };
}

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bufferToBase64(digest);
}

export function randomToken(bytes = 32) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return bufferToBase64(values.buffer).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function getCurrentUser(request: Request): Promise<AuthUser | null> {
  const token = getSessionToken(request);
  if (!token) return null;
  await ensureSchema();
  const tokenHash = await hashToken(token);
  const db = await getD1();
  const row = await db
    .prepare(
      "SELECT users.id, users.email, users.name FROM auth_sessions INNER JOIN users ON users.id = auth_sessions.user_id WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?",
    )
    .bind(tokenHash, new Date().toISOString())
    .first<AuthUser>();
  return row ?? null;
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
  const db = await getD1();
  await db
    .prepare("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, await hashToken(token), expiresAt.toISOString(), now.toISOString())
    .run();
  return token;
}

function bufferToBase64(buffer: ArrayBuffer) {
  let value = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}
