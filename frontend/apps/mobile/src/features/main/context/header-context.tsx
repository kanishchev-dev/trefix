import { createContext, useContext, useEffect, type ReactNode } from "react";

export type HeaderOptions = {
  leftAction?: ReactNode;
  centerContent?: ReactNode;
  rightAction?: ReactNode;
  variant?: "default" | "calendar";
  bottomContent?: ReactNode;
  /** `surface`: the screen starts with a card-coloured block, the header blends into it. */
  tone?: "screen" | "surface";
};

type HeaderContextValue = {
  options: HeaderOptions;
  setOptions: (options: HeaderOptions) => void;
};

export const HeaderContext = createContext<HeaderContextValue | null>(null);

export function useHeaderOptions(options: HeaderOptions, deps: unknown[] = []) {
  const context = useContext(HeaderContext);
  useEffect(() => {
    if (context) {
      context.setOptions(options);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
