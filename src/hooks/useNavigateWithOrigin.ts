import { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Returns a navigate function that automatically includes
 * the current URL (pathname + search) as `state.from`.
 */
export function useNavigateWithOrigin() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (to: string, extra?: Record<string, any>) => {
      const from = location.pathname + location.search;
      navigate(to, { state: { from, ...extra } });
    },
    [navigate, location.pathname, location.search]
  );
}

/**
 * Returns a function to go back to the origin URL stored in
 * location.state.from, or to a fallback route.
 */
export function useOriginBack(fallback: string) {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    const from = (location.state as any)?.from;
    if (from && typeof from === "string" && from.startsWith("/")) {
      navigate(from);
    } else {
      navigate(fallback);
    }
  }, [navigate, location.state, fallback]);
}
