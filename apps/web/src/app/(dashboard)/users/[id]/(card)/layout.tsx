"use client";

import { use, type ReactElement, type ReactNode } from "react";

import { UserCardHeader } from "@/features/users/components/card/user-card-header";
import { UserCardProvider } from "@/features/users/context/user-card-context";
import { useUser } from "@/features/users/hooks/use-users";
import { DetailSkeleton, ErrorState } from "@/widgets/data-state";
import { UserSectionNav } from "@/widgets/user-section-nav";

export default function UserCardLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: ReactNode;
}): ReactElement {
  const { id } = use(params);
  const userQuery = useUser(id);

  if (userQuery.isLoading) {
    return <DetailSkeleton />;
  }

  if (userQuery.isError || !userQuery.data) {
    return <ErrorState onRetry={() => userQuery.refetch()} />;
  }

  return (
    <UserCardProvider user={userQuery.data}>
      <div className="flex flex-col gap-4">
        <UserCardHeader user={userQuery.data} />
        <UserSectionNav userId={id} />
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </UserCardProvider>
  );
}
