"use client";

import { use, type ReactElement } from "react";

import { UserIntegrationsSection } from "@/features/user-integrations/components/user-integrations-section";

export default function UserIntegrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): ReactElement {
  const { id } = use(params);
  return <UserIntegrationsSection userId={id} />;
}
