"use client";

import { useCallback, useRef, useState, type ReactElement } from "react";

import { Button } from "@workspace/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { CheckIcon, CopyIcon } from "lucide-react";

import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";

/**
 * Copies `value` to the clipboard and confirms it twice: the icon flips to a
 * check mark for a couple of seconds, and a toast fires. The icon alone is easy
 * to miss in a dense table or card, and silently doing nothing on a failed copy
 * is worse than saying so.
 *
 * The reset timer is kept in a ref so a rapid second click restarts the window
 * instead of queueing another timeout that would clear the check early.
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  /** Accessible name, e.g. "Copy user ID". */
  label: string;
  className?: string;
}): ReactElement {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      notifySuccess(t("common.actions.copied"));

      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
      resetTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notifyError(t("common.states.error"), t("common.actions.copyFailed"));
    }
  }, [t, value]);

  const icon = copied ? (
    <CheckIcon data-icon="inline-start" />
  ) : (
    <CopyIcon data-icon="inline-start" />
  );

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            className={className}
            onClick={onCopy}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
