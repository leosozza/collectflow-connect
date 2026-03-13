/**
 * Centralized structured logger for all services.
 * Outputs JSON to console for easy parsing and debugging.
 */
export const logger = {
  info: (module: string, action: string, data?: Record<string, any>) =>
    console.log(
      JSON.stringify({ level: "info", module, action, ...data, ts: new Date().toISOString() })
    ),

  warn: (module: string, action: string, data?: Record<string, any>) =>
    console.warn(
      JSON.stringify({ level: "warn", module, action, ...data, ts: new Date().toISOString() })
    ),

  error: (module: string, action: string, error: unknown, data?: Record<string, any>) =>
    console.error(
      JSON.stringify({
        level: "error",
        module,
        action,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ...data,
        ts: new Date().toISOString(),
      })
    ),
};
