"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { AdminUserDetail } from "@trefix/api-client";

const UserCardContext = createContext<AdminUserDetail | null>(null);

/** The user whose card is open; loaded once by the card layout for every section. */
export function UserCardProvider({
  user,
  children,
}: {
  user: AdminUserDetail;
  children: ReactNode;
}) {
  return (
    <UserCardContext.Provider value={user}>{children}</UserCardContext.Provider>
  );
}

export function useUserCard(): AdminUserDetail {
  const user = useContext(UserCardContext);
  if (!user) {
    throw new Error("useUserCard must be used inside the user card layout");
  }
  return user;
}

export function displayNameOf(user: {
  firstName: string;
  lastName: string;
  email: string;
}): string {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
  );
}
