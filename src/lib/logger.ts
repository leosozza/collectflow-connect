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
        error: error instanceof Error ? error.message : (typeof error === 'object' ? JSON.stringify(error) : String(error)),
        stack: error instanceof Error ? error.stack : undefined,
        ...data,
        ts: new Date().toISOString(),
      })
    ),

  /** Start a timer and return a function to log the elapsed time */
  timed: (module: string, action: string) => {
    const start = performance.now();
    return (data?: Record<string, any>) => {
      const duration = Math.round(performance.now() - start);
      console.log(
        JSON.stringify({ level: "info", module, action, duration_ms: duration, ...data, ts: new Date().toISOString() })
      );
    };
  },
};
