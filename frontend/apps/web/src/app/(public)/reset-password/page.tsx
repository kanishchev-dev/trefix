import { Suspense, type ReactElement } from "react";

import { ResetPasswordForm } from "@/components/reset-password-form";

export default function ResetPasswordPage(): ReactElement {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<div>Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
