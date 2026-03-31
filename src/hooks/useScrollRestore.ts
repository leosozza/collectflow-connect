import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Saves scroll position to sessionStorage on unmount,
 * restores it on mount (after a frame so content is rendered).
 */
export function useScrollRestore() {
  const { pathname } = useLocation();
  const key = `scroll:${pathname}`;
  const scrollRef = useRef(0);

  // Track scroll continuously so cleanup always has latest value
  useEffect(() => {
    const handler = () => { scrollRef.current = window.scrollY; };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(key);
    if (saved) {
      const pos = parseInt(saved, 10);
      if (!isNaN(pos) && pos > 0) {
        requestAnimationFrame(() => {
          window.scrollTo(0, pos);
        });
      }
      sessionStorage.removeItem(key);
    }

    return () => {
      if (scrollRef.current > 0) {
        sessionStorage.setItem(key, String(scrollRef.current));
      }
    };
  }, [key]);
}
