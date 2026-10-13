import { useCallback, useEffect, useRef, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

const START_DELAY_MS = 120;
const LOGO_DURATION_MS = 750;
const CONTENT_DELAY_MS = START_DELAY_MS + 380;
const CONTENT_DURATION_MS = 500;
/** Don't hold the native splash forever if the logo image never reports a load. */
const LOGO_LOAD_TIMEOUT_MS = 400;

/** The intro hands over from the native splash, so it only makes sense on a cold start. */
let hasPlayedIntro = false;

/**
 * Splash → auth screen hand-over. The native splash stays up until the screen has
 * laid out and the logo image is decoded, so the first frame matches it exactly;
 * then the logo travels to its place and the rest of the screen fades in.
 *
 * `logoProgress` and `contentProgress` go 0 → 1. `isGlassShown` flips when the
 * content starts appearing: glass views can't be faded with opacity, they are
 * materialized natively instead.
 */
export function useAuthIntro() {
  const reduceMotion = useReducedMotion();
  const [isAnimated] = useState(() => !hasPlayedIntro && !reduceMotion);
  const logoProgress = useSharedValue(isAnimated ? 0 : 1);
  const contentProgress = useSharedValue(isAnimated ? 0 : 1);
  const [rootHeight, setRootHeight] = useState<number | null>(null);
  const [isLogoLoaded, setLogoLoaded] = useState(false);
  const [isGlassShown, setGlassShown] = useState(!isAnimated);
  const [isDone, setDone] = useState(!isAnimated);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!isAnimated) {
      return;
    }

    const timeout = setTimeout(() => setLogoLoaded(true), LOGO_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [isAnimated]);

  useEffect(() => {
    if (hasStarted.current || rootHeight === null) {
      return;
    }

    if (!isAnimated) {
      hasStarted.current = true;
      void SplashScreen.hideAsync();
      return;
    }

    if (!isLogoLoaded) {
      return;
    }

    hasStarted.current = true;
    hasPlayedIntro = true;

    void SplashScreen.hideAsync()
      .catch(() => undefined)
      .then(() => {
        logoProgress.value = withDelay(
          START_DELAY_MS,
          withTiming(1, {
            duration: LOGO_DURATION_MS,
            easing: Easing.bezier(0.33, 0, 0.15, 1),
          }),
        );
        contentProgress.value = withDelay(
          CONTENT_DELAY_MS,
          withTiming(
            1,
            {
              duration: CONTENT_DURATION_MS,
              easing: Easing.out(Easing.cubic),
            },
            (finished) => {
              if (finished) {
                runOnJS(setDone)(true);
              }
            },
          ),
        );
      });
  }, [contentProgress, isAnimated, isLogoLoaded, logoProgress, rootHeight]);

  useAnimatedReaction(
    () => contentProgress.value > 0,
    (isRevealing, wasRevealing) => {
      if (isRevealing && !wasRevealing) {
        runOnJS(setGlassShown)(true);
      }
    },
  );

  const onLogoLoad = useCallback(() => setLogoLoaded(true), []);

  return {
    isAnimated,
    rootHeight,
    setRootHeight,
    onLogoLoad,
    logoProgress,
    contentProgress,
    isGlassShown,
    isDone,
  };
}
