type LogLevel = "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

/**
 * Minimal structured JSON logger. Emits one line per event so it is easy to
 * filter/grep in Vercel function logs. Never include secrets or full card data.
 */
export function log(level: LogLevel, scope: string, event: string, fields: LogFields = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    event,
    ...fields,
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * Short correlation id returned to the client on failures so a user can quote it
 * to support and we can match it to the server-side log line.
 */
export function newCorrelationId() {
  return `nt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Extracts a safe error message for server logs (never sent verbatim to client). */
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
