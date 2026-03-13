import { useSearchParams } from "react-router-dom";
import { useCallback, useMemo } from "react";

/**
 * Sync a single value with a URL search param.
 * - Default values are omitted from URL (clean URLs).
 * - Supports string, number, boolean, and string[] (comma-separated).
 */
export function useUrlState(
  key: string,
  defaultValue: string
): [string, (val: string) => void];
export function useUrlState(
  key: string,
  defaultValue: number
): [number, (val: number) => void];
export function useUrlState(
  key: string,
  defaultValue: boolean
): [boolean, (val: boolean) => void];
export function useUrlState(
  key: string,
  defaultValue: string[]
): [string[], (val: string[]) => void];
export function useUrlState(
  key: string,
  defaultValue: string | number | boolean | string[]
): [any, (val: any) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = useMemo((): T => {
    const raw = searchParams.get(key);
    if (raw === null) return defaultValue;

    // string[]
    if (Array.isArray(defaultValue)) {
      return (raw === "" ? [] : raw.split(",")) as T;
    }
    // boolean
    if (typeof defaultValue === "boolean") {
      return (raw === "1" || raw === "true") as T;
    }
    // number
    if (typeof defaultValue === "number") {
      const n = Number(raw);
      return (isNaN(n) ? defaultValue : n) as T;
    }
    // string
    return raw as T;
  }, [searchParams, key, defaultValue]);

  const setValue = useCallback(
    (val: T) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const isDefault =
            Array.isArray(defaultValue) && Array.isArray(val)
              ? val.length === (defaultValue as string[]).length &&
                val.every((v, i) => v === (defaultValue as string[])[i])
              : val === defaultValue;

          if (isDefault) {
            next.delete(key);
          } else if (typeof val === "boolean") {
            next.set(key, val ? "1" : "0");
          } else if (Array.isArray(val)) {
            next.set(key, val.join(","));
          } else {
            next.set(key, String(val));
          }
          return next;
        },
        { replace: true }
      );
    },
    [key, defaultValue, setSearchParams]
  );

  return [value, setValue];
}

/**
 * Sync a record of filters with URL search params.
 * All values are strings. Default values are omitted from URL.
 */
export function useUrlFilters<T extends Record<string, string>>(
  defaults: T
): [T, (key: keyof T, value: string) => void, () => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo((): T => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const raw = searchParams.get(key);
      if (raw !== null) {
        (result as any)[key] = raw;
      }
    }
    return result;
  }, [searchParams, defaults]);

  const setFilter = useCallback(
    (key: keyof T, value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === defaults[key]) {
            next.delete(key as string);
          } else {
            next.set(key as string, value);
          }
          return next;
        },
        { replace: true }
      );
    },
    [defaults, setSearchParams]
  );

  const clearAll = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of Object.keys(defaults)) {
          next.delete(key);
        }
        return next;
      },
      { replace: true }
    );
  }, [defaults, setSearchParams]);

  return [filters, setFilter, clearAll];
}
