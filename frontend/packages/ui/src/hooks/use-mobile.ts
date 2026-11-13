import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT_QUERY = "(max-width: 768px)";

/**
 * Tracks whether the viewport matches the mobile breakpoint.
 * Used by the sidebar component to switch between the fixed and sheet mode.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const query = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    setIsMobile(query.matches);

    const listener = (event: MediaQueryListEvent): void => {
      setIsMobile(event.matches);
    };

    query.addEventListener("change", listener);
    return () => {
      query.removeEventListener("change", listener);
    };
  }, []);

  return isMobile;
}
