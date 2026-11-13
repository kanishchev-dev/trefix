"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import type { AppSettings, UpdateSettingsInput } from "@trefix/api-client";

import { fetchSettings, patchSettings } from "@/entities/settings/api";

export const settingsKeys = {
  all: ["settings"] as const,
  root: ["settings", "root"] as const,
};

export function useSettings(): UseQueryResult<AppSettings> {
  return useQuery({
    queryKey: settingsKeys.root,
    queryFn: fetchSettings,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => patchSettings(input),
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsKeys.root, settings);
    },
  });
}
