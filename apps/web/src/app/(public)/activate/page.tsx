import { Suspense, type ReactElement } from "react";

import { Skeleton } from "@workspace/ui/components/skeleton";

import { ActivateInviteForm } from "@/components/activate-invite-form";

export default function ActivateInvitePage(): ReactElement {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ActivateInviteForm />
      </Suspense>
    </div>
  );
}