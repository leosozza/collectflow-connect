import { useState, useEffect, useCallback } from "react";

/**
 * Hook persistente em sessionStorage. Útil para preservar estado UI
 * (filtros, rascunhos) durante a sessão do operador, sobrevivendo
 * a navegações entre páginas mas não a fechamento do navegador.
 */
export function useSessionStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [stored, setStored] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw === null) return initialValue;
      return JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const next = typeof value === "function" ? (value as (p: T) => T)(prev) : value;
        try {
          window.sessionStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* quota / privacy mode */
        }
        return next;
      });
    },
    [key]
  );

  const remove = useCallback(() => {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      /* noop */
    }
    setStored(initialValue);
  }, [key, initialValue]);

  // Mantém sincronizado entre abas/janelas que compartilham sessionStorage
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStored(JSON.parse(e.newValue) as T);
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  return [stored, setValue, remove];
}
