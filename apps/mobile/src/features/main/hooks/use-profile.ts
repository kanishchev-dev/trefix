import { useQuery } from "@tanstack/react-query";
import { getMe } from "../../../lib/auth-api";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => getMe(),
  });
}
