type GoogleSigninModule =
  typeof import("@react-native-google-signin/google-signin");

let googleSigninModule: GoogleSigninModule | null = null;

export function getGoogleSigninModule(): GoogleSigninModule | null {
  if (googleSigninModule) {
    return googleSigninModule;
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
