import type { Campaign } from "@/services/campaignService";

// Brasília timezone (BRT) is fixed UTC-3 — no DST since 2019.
const BRT_OFFSET = "-03:00";

const isValidDateStr = (s?: string | null): boolean => {
  if (!s) return false;
  // Accepts YYYY-MM-DD or full ISO; we just need a parseable year.
  const ts = Date.parse(s);
  if (isNaN(ts)) return false;
  const y = new Date(ts).getFullYear();
  return y >= 2000 && y <= 2100;
};

/** Extracts YYYY-MM-DD from a date or ISO string. */
const toDatePart = (s: string): string => s.slice(0, 10);

/** Normalizes "HH:mm" or "HH:mm:ss" (or null) to "HH:mm:ss". */
const toTimePart = (s: string | null | undefined, fallback: string): string => {
  if (!s) return fallback;
  const trimmed = s.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  return fallback;
};

/** Combines a date + time as São Paulo wall time and returns a UTC ms timestamp. */
const combineBRT = (datePart: string, timePart: string): number => {
  // e.g. "2026-04-30T17:45:00-03:00"
  const ts = Date.parse(`${datePart}T${timePart}${BRT_OFFSET}`);
  return isNaN(ts) ? NaN : ts;
};

export const getCampaignEndMs = (
  campaign: Pick<Campaign, "end_date" | "end_time">,
): number => {
  if (!isValidDateStr(campaign.end_date)) return NaN;
  const date = toDatePart(campaign.end_date);
  const time = toTimePart(campaign.end_time as unknown as string | null, "23:59:59");
  return combineBRT(date, time);
};

export const getCampaignStartMs = (
  campaign: Pick<Campaign, "start_date"> & { start_time?: string | null },
): number => {
  if (!isValidDateStr(campaign.start_date)) return NaN;
  const date = toDatePart(campaign.start_date);
  const time = toTimePart(campaign.start_time ?? null, "00:00:00");
  return combineBRT(date, time);
};

export const hasValidCampaignDates = (
  campaign: Pick<Campaign, "start_date" | "end_date">,
): boolean => isValidDateStr(campaign.start_date) && isValidDateStr(campaign.end_date);

export const isCampaignActive = (campaign: Campaign): boolean => {
  if (campaign.status !== "ativa") return false;
  if (!hasValidCampaignDates(campaign)) return false;
  const endMs = getCampaignEndMs(campaign);
  if (isNaN(endMs)) return false;
  return endMs > Date.now();
};
