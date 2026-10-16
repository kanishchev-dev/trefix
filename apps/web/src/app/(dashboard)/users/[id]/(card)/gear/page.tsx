"use client";

import { use, type ReactElement } from "react";

import { UserGearSection } from "@/features/user-athlete/components/user-gear-section";

export default function UserGearPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): ReactElement {
  const { id } = use(params);
  return <UserGearSection userId={id} />;
}
