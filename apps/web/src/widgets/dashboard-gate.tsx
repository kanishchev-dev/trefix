"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactElement, type ReactNode } from "react";

import { Button } from "@workspace/ui/components/button";
import { ShieldXIcon } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/shared/i18n";

const SECTION_PERMISSIONS: Array<{ prefix: string; permission: string }> = [
  { prefix: "/users/list", permission: "users.read" },
  { prefix: "/users/create", permission: "users.create" },
  { prefix: "/users", permission: "users.read" },
  { prefix: "/settings/authentication", permission: "permissions.read" },
  // Editing your own profile is what `account.update` stands for, so the page
  // follows the same rule as the menu entry that links to it.
  { prefix: "/profile", permission: "account.update" },
];

function requiredPermission(pathname: string): string | null {
  const match = SECTION_PERMISSIONS.find((entry) => pathname.startsWith(entry.prefix));
  return match?.permission ?? null;
}

export function DashboardGate({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const { status, isAuthenticated, hasPermission } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  /**
   * A session that dies while the app is open (revoked elsewhere, token
   * rejected) leaves the gate with nothing to render.
   *
   * Treating that the same as "still resolving" — an empty span — produced a
   * blank page that only a manual reload could clear, because the server
   * middleware never runs on a client-side transition. The middleware already
   * sends an unauthenticated visitor to /login; this makes the client agree.
   */
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  if (status === "loading") {
    return <span aria-hidden="true" />;
  }

  if (!isAuthenticated) {
    return <span aria-hidden="true" />;
  }

  const permission = requiredPermission(pathname);
  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <ShieldXIcon className="size-10 text-muted-foreground" />
        <p className="text-lg font-medium">{t("accessDenied.title")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("accessDenied.description")}
        </p>
        <Button variant="outline" render={<Link href="/dashboard" />}>
          {t("accessDenied.backToDashboard")}
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
