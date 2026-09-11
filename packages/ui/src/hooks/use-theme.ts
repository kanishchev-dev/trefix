import { useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  return {
    theme,
    setTheme,
  };
}
