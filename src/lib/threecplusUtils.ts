/**
 * Utilities for normalizing 3CPlus API responses.
 * The 3CPlus API returns data in inconsistent formats across endpoints.
 */

/** Extract array from any 3CPlus response shape */
export function extractList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data?.data?.data && Array.isArray(data.data.data)) return data.data.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/** Extract a single object from any 3CPlus response shape (unwraps proxy wrapper + nested data) */
export function extractObject(data: any): Record<string, any> {
  if (!data || typeof data !== 'object') return {};
  // If has .data and .data is an object (not array), unwrap
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    // Could have data.data.data (3CPlus inconsistency)
    if (data.data.data && typeof data.data.data === 'object' && !Array.isArray(data.data.data)) {
      return data.data.data;
    }
    return data.data;
  }
  // Remove proxy-added fields (status, success) and return the rest
  const { status, success, ...rest } = data;
  return rest;
}

/** Normalize campaign status into a predictable shape */
export function normalizeCampaignStatus(c: any): {
  isRunning: boolean;
  isPaused: boolean;
  statusLabel: string;
  progress: number;
  total: number;
  worked: number;
  aggressiveness: number;
} {
  const status = (c.status || "").toLowerCase();
  const isPaused = status === "paused" || status === "stopped" || c.paused === true;
  const isRunning = !isPaused && (status === "running" || status === "active" || c.is_on_active_time === true);

  const statusLabel = isPaused ? "Pausada" : isRunning ? "Ativa" : "Inativa";

  // Progress: try multiple field paths
  const total =
    c.statistics?.total_records ??
    c.statistics?.total ??
    c.total_records ??
    c.total ??
    0;

  const worked =
    c.statistics?.worked_records ??
    c.statistics?.completed ??
    c.worked_records ??
    c.completed ??
    0;

  const progress = total > 0 ? Math.round((worked / total) * 100) : 0;

  // Aggressiveness: try multiple field paths
  const aggressiveness =
    c.aggressiveness ??
    c.power ??
    c.dialer_settings?.aggressiveness ??
    1;

  return { isRunning, isPaused, statusLabel, progress, total, worked, aggressiveness };
}

/** Determine user active status from multiple possible field names */
export function isUserActive(u: any): boolean {
  if (u.active === false) return false;
  if (u.is_active === false) return false;
  if (u.status === "inactive" || u.status === "disabled") return false;
  if (u.deleted_at != null) return false;
  return true;
}
