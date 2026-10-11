import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getMe, updateMe, uploadAvatar } from "../../../lib/auth-api";
import { queryKeys } from "../../../shared/lib/query-keys";

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile.all,
    queryFn: () => getMe(),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
    },
  });
}

/** Uploads the avatar; the server saves it on the user right away. */
export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
    },
  });
}
