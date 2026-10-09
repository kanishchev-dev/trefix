/** Screens of the profile tab pushed over the tabs. */
export type ProfileRoute =
  | { kind: "profile-body" }
  | { kind: "profile-heart" }
  | { kind: "profile-schedule" }
  | { kind: "profile-experience" }
  | { kind: "profile-gear" }
  | { kind: "profile-gear-edit"; gearId?: string }
  | { kind: "settings-units" }
  | { kind: "settings-coach" }
  | { kind: "profile-wizard"; step?: 1 | 2 | 3 };

export type ProfileNavigate = (route: ProfileRoute) => void;
