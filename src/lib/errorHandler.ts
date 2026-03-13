import { logger } from "@/lib/logger";

/**
 * Typed application error with error code for consistent error handling.
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Standard error handler for services.
 * Logs the error and re-throws as AppError.
 */
export function handleServiceError(error: unknown, module: string): never {
  logger.error(module, "service_error", error);

  if (error instanceof AppError) throw error;

  const message = error instanceof Error ? error.message : "Erro desconhecido";
  throw new AppError("INTERNAL", message);
}

/**
 * Wraps an async service function with standard error handling.
 * Useful for applying consistent try/catch to service methods.
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  module: string
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleServiceError(error, module);
    }
  }) as T;
}
