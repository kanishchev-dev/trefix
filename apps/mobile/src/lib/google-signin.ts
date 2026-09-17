import { NativeModules, Platform } from "react-native";

type GoogleSigninModule =
  typeof import("@react-native-google-signin/google-signin");

let googleSigninModule: GoogleSigninModule | null = null;

export function getGoogleSigninModule(): GoogleSigninModule | null {
  if (googleSigninModule) {
    return googleSigninModule;
  }

  // Check if the native module is registered.
  // RNGoogleSignin is the name used by the library.
  const isNativeModuleAvailable = !!NativeModules.RNGoogleSignin;

  if (!isNativeModuleAvailable && Platform.OS !== "web") {
    return null;
  }

  try {
    googleSigninModule =
      require("@react-native-google-signin/google-signin") as GoogleSigninModule;
    return googleSigninModule;
  } catch {
    googleSigninModule = null;
    return null;
  }
}

export function isGoogleSigninAvailable(): boolean {
  return getGoogleSigninModule() !== null;
}
