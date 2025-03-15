"use client";

import { useSession } from "@/app/(main)/SessionProvider";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to check if the current user is subscribed to a creator
 * @param creatorId ID of the creator
 * @returns Object containing subscription status and loading state
 */
export function useSubscriptionCheck(creatorId: string) {
  const { user } = useSession();

  // If the user is the creator, they're always "subscribed" to themselves
  const isSelf = user?.id === creatorId;

  const { data, isLoading } = useQuery({
    queryKey: ["subscription", creatorId, user?.id],
    queryFn: async () => {
      if (isSelf) return { subscribed: true };
      
      const response = await fetch(`/api/subscription/check?creatorId=${creatorId}`);
      if (!response.ok) {
        throw new Error("Failed to check subscription status");
      }
      return response.json();
    },
    // No need to refetch too often for subscription status
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!user && !!creatorId
  });

  return {
    isSubscribed: data?.subscribed || isSelf,
    isLoading,
  };
}
