"use client";

import { useState, type ReactElement, type ReactNode } from "react";

import { Button } from "@trefix/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@trefix/ui/components/dialog";
import { Spinner } from "@trefix/ui/components/spinner";

import type {
  PlanChangePreview,
  PlanChangeRequest,
} from "@trefix/api-client";

import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";

import {
  useApplyPlanChanges,
  usePreviewPlanChanges,
} from "../hooks/use-user-plans";
import { isVersionConflict } from "../lib/plan-errors";
import { formatPlanDate } from "../lib/plan-format";
import { PlanDiffView } from "./plan-diff-view";

/**
 * Two-step change of the active plan, the same protocol the app uses: the
 * admin fills the form, sees the diff the engine computed, then applies
 * exactly that request. Editing the form after a preview drops the preview.
 */
export function PlanChangeDialog({
  userId,
  planId,
  open,
  onOpenChange,
  title,
  description,
  request,
  describe,
  children,
}: {
  userId: string;
  planId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** The change built from the form; `null` while the form is incomplete. */
  request: PlanChangeRequest | null;
  describe?: (key: string) => string | undefined;
  children: ReactNode;
}): ReactElement {
  const { t, locale } = useI18n();
  const previewChanges = usePreviewPlanChanges(userId, planId);
  const applyChanges = useApplyPlanChanges(userId, planId);
  const [preview, setPreview] = useState<{
    request: PlanChangeRequest;
    result: PlanChangePreview;
  } | null>(null);

  // A preview is valid only for the exact request it was computed for.
  const currentPreview =
    preview &&
    request &&
    JSON.stringify(preview.request) === JSON.stringify(request)
      ? preview
      : null;
  const isPending = previewChanges.isPending || applyChanges.isPending;

  const handleError = (error: unknown) => {
    if (isVersionConflict(error)) {
      notifyError(t("userPlans.errors.versionConflict"));
      close();
      return;
    }
    notifyError(t("common.states.error"), getFriendlyApiMessage(error, t));
  };

  const close = () => {
    setPreview(null);
    onOpenChange(false);
  };

  const runPreview = () => {
    if (!request) return;
    previewChanges.mutate(request, {
      onSuccess: (result) => setPreview({ request, result }),
      onError: handleError,
    });
  };

  const apply = () => {
    if (!currentPreview) return;
    applyChanges.mutate(
      {
        ...currentPreview.request,
        expectedVersion: currentPreview.result.version,
      },
      {
        onSuccess: () => {
          notifySuccess(t("userPlans.toasts.changesApplied"));
          close();
        },
        onError: handleError,
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) =>
        next ? onOpenChange(true) : !isPending && close()
      }
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="flex flex-col gap-4">{children}</div>

        {currentPreview ? (
          <div className="flex flex-col gap-2 rounded-xl border p-4">
            <span className="text-sm font-medium">
              {t("userPlans.diff.title")}
            </span>
            {currentPreview.result.resultingEndDate ? (
              <span className="text-sm text-muted-foreground">
                {t("userPlans.diff.resultingEnd", {
                  date: formatPlanDate(
                    currentPreview.result.resultingEndDate,
                    locale,
                  ),
                })}
              </span>
            ) : null}
            <PlanDiffView
              diff={currentPreview.result.diff}
              warnings={currentPreview.result.warnings}
              describe={describe}
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={close}
          >
            {t("common.actions.cancel")}
          </Button>
          {currentPreview ? (
            <Button type="button" disabled={isPending} onClick={apply}>
              {applyChanges.isPending ? <Spinner /> : null}
              {t("userPlans.actions.apply")}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={isPending || !request}
              onClick={runPreview}
            >
              {previewChanges.isPending ? <Spinner /> : null}
              {t("userPlans.actions.preview")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
