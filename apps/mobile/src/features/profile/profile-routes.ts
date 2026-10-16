/** Screens of the profile tab pushed over the tabs. */
export type ProfileRoute =
  | { kind: "profile-running" }
  | { kind: "profile-body" }
  | { kind: "profile-heart" }
  | { kind: "profile-zones" }
  | { kind: "profile-schedule" }
  | { kind: "profile-experience" }
  | { kind: "profile-gear" }
  | {
      kind: "profile-gear-edit";
      gearId?: string;
      type?: "shoes" | "watch" | "sensor";
    }
  | { kind: "profile-gear-detail"; gearId: string }
  | { kind: "profile-gear-archive" }
  | { kind: "settings-units" }
  | { kind: "settings-coach" }
  | { kind: "settings-account" }
  | { kind: "settings-email" }
  | { kind: "connect-service"; service: "strava" | "garmin" | "health" }
  | { kind: "profile-wizard"; step?: 1 | 2 | 3 };

export type ProfileNavigate = (route: ProfileRoute) => void;
