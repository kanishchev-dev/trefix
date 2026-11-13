"use client";

import { use, type ReactElement } from "react";

import { UserAccountSection } from "@/features/user-account/components/user-account-section";

export default function UserAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): ReactElement {
  const { id } = use(params);
  return <UserAccountSection userId={id} />;
}
