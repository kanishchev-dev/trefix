import type { ReactElement } from "react";

import { ChangePasswordForm } from "@/features/profile/components/change-password-form";
import { ProfileForm } from "@/features/profile/components/profile-form";

export default function ProfilePage(): ReactElement {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <ProfileForm />
      <ChangePasswordForm />
    </div>
  );
}
