"use client";

import { toast } from "@trefix/ui/components/toast";

export function notifySuccess(title: string, description?: string) {
  toast.add({
    title,
    description,
    type: "success",
    priority: "high",
  });
}

export function notifyError(title: string, description?: string) {
  toast.add({
    title,
    description,
    type: "error",
    priority: "high",
  });
}

export function notifyInfo(title: string, description?: string) {
  toast.add({
    title,
    description,
    type: "info",
  });
}
