import { useSearchParams, useLocation } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef } from "react";

const STORAGE_PREFIX = "urlstate:";

function storageKey(pathname: string, key: string) {
  return `${STORAGE_PREFIX}${pathname}:${key}`;
}

function ssGet(k: string): string | null {
  try { return sessionStorage.getItem(k); } catch { return null; }
}
function ssSet(k: string, v: string) {
  try { sessionStorage.setItem(k, v); } catch { /* quota */ }
}
function ssRemove(k: string) {
  try { sessionStorage.removeItem(k); } catch { /* noop */ }
}

/**
 * Sync a single value with a URL search param.
 * Persists to sessionStorage so values survive route changes.
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
  const { pathname } = useLocation();
  const sk = storageKey(pathname, key);
  const restoredRef = useRef(false);

  // Read: URL → sessionStorage → default
  const value = useMemo(() => {
    const raw = searchParams.get(key);
    const effective = raw ?? ssGet(sk);

    if (effective === null) return defaultValue;

    if (Array.isArray(defaultValue)) {
      return effective === "" ? [] : effective.split(",");
    }
    if (typeof defaultValue === "boolean") {
      return effective === "1" || effective === "true";
    }
    if (typeof defaultValue === "number") {
      const n = Number(effective);
      return isNaN(n) ? defaultValue : n;
    }
    return effective;
  }, [searchParams, key, defaultValue, sk]);

  // Restore: if sessionStorage has value but URL doesn't, push to URL once
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const raw = searchParams.get(key);
    if (raw !== null) return; // URL already has it
    const stored = ssGet(sk);
    if (stored === null) return; // nothing to restore

    // Check if stored equals default — if so, don't pollute URL
    const isDefault =
      Array.isArray(defaultValue)
        ? stored === defaultValue.join(",") || (stored === "" && defaultValue.length === 0)
        : typeof defaultValue === "boolean"
          ? (stored === "1" || stored === "true") === defaultValue
          : typeof defaultValue === "number"
            ? Number(stored) === defaultValue
            : stored === defaultValue;

    if (isDefault) return;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(key, stored);
        return next;
      },
      { replace: true }
    );
  }, []); // run once on mount

  const setValue = useCallback(
    (val: any) => {
      const isDefault =
        Array.isArray(defaultValue) && Array.isArray(val)
          ? val.length === (defaultValue as string[]).length &&
            val.every((v: string, i: number) => v === (defaultValue as string[])[i])
          : val === defaultValue;

      // Update sessionStorage
      if (isDefault) {
        ssRemove(sk);
      } else if (typeof val === "boolean") {
        ssSet(sk, val ? "1" : "0");
      } else if (Array.isArray(val)) {
        ssSet(sk, val.join(","));
      } else {
        ssSet(sk, String(val));
      }

      // Update URL
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
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
    [key, defaultValue, setSearchParams, sk]
  );

  return [value, setValue];
}

/**
 * Sync a record of filters with URL search params.
 * Persists to sessionStorage so values survive route changes.
 */
export function useUrlFilters<T extends Record<string, string>>(
  defaults: T
): [T, (key: keyof T, value: string) => void, () => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();
  const restoredRef = useRef(false);

  const filters = useMemo((): T => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const raw = searchParams.get(key);
      if (raw !== null) {
        (result as any)[key] = raw;
      } else {
        const stored = ssGet(storageKey(pathname, key));
        if (stored !== null) {
          (result as any)[key] = stored;
        }
      }
    }
    return result;
  }, [searchParams, defaults, pathname]);

  // Restore stored values to URL on mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const toRestore: Record<string, string> = {};
    for (const key of Object.keys(defaults)) {
      if (searchParams.get(key) !== null) continue;
      const stored = ssGet(storageKey(pathname, key));
      if (stored !== null && stored !== defaults[key]) {
        toRestore[key] = stored;
      }
    }
    if (Object.keys(toRestore).length === 0) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(toRestore)) {
          next.set(k, v);
        }
        return next;
      },
      { replace: true }
    );
  }, []);

  const setFilter = useCallback(
    (key: keyof T, value: string) => {
      const sk = storageKey(pathname, key as string);
      if (value === defaults[key]) {
        ssRemove(sk);
      } else {
        ssSet(sk, value);
      }
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
    [defaults, setSearchParams, pathname]
  );

  const clearAll = useCallback(() => {
    for (const key of Object.keys(defaults)) {
      ssRemove(storageKey(pathname, key));
    }
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
  }, [defaults, setSearchParams, pathname]);

  return [filters, setFilter, clearAll];
}
