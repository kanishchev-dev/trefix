import type { ReactElement, ReactNode } from "react";

/** Label-over-value pair used by the read-only blocks of a user's card. */
export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}): ReactElement {
  return (
    <div className="flex flex-col gap-1 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium break-words">{value}</span>
    </div>
  );
}
