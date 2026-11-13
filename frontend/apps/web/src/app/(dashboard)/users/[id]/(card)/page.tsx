"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, type ReactElement } from "react";

import { UserOverview } from "@/features/user-overview/components/user-overview";
import {
  legacyTabSection,
  userSectionHref,
} from "@/features/users/lib/user-sections";

export default function UserOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): ReactElement | null {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacySection = legacyTabSection(searchParams.get("tab"));

  // Links from before the sections had their own paths used `?tab=`.
  useEffect(() => {
    if (legacySection) {
      const rest = new URLSearchParams(searchParams);
      rest.delete("tab");
      const query = rest.toString();
      const href = userSectionHref(id, legacySection);
      router.replace(query ? `${href}?${query}` : href);
    }
  }, [id, legacySection, router, searchParams]);

  if (legacySection) return null;
  return <UserOverview userId={id} />;
}
