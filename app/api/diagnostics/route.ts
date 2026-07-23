import { NextResponse } from "next/server";
import { ensureSchema, getD1 } from "../_lib/auth-store";

function diagnosticError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[FocusFlow diagnostics]", message);
  const code = /D1 binding DB is unavailable|env\.DB|Cannot read properties of undefined.*DB/i.test(message)
    ? "D1_BINDING_MISSING"
    : /SQLITE|no such table|no such column|D1_/i.test(message)
      ? "D1_SQL_ERROR"
      : "DIAGNOSTICS_ERROR";

  return NextResponse.json({
    ok: false,
    code,
    detail: message,
  }, { status: 503 });
}

export async function GET() {
  try {
    await ensureSchema();
    const db = await getD1();
    const tables = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all<{ name: string }>();

    return NextResponse.json({
      ok: true,
      binding: "DB",
      tables: (tables.results ?? []).map((row) => row.name),
    });
  } catch (error) {
    return diagnosticError(error);
  }
}
