"use client";

import { useSession } from "@/app/(main)/SessionProvider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

export type Subscription = {
  id: string;
  tierId: string;
  expiresAt: string;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
  tier: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    duration: number;
    creatorId: string;
    creator: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      bio: string | null;
    };
  };
};

type PaginatedResponse = {
  subscriptions: Subscription[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

/**
 * Hook to fetch and manage user subscriptions
 */
export function useSubscriptions(page = 1, limit = 10) {
  const { user } = useSession();
  const queryClient = useQueryClient();

  // Fetch subscriptions
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<PaginatedResponse>({
    queryKey: ["subscriptions", page, limit, user?.id],
    queryFn: async () => {
      const response = await fetch(
        `/api/subscriptions?page=${page}&limit=${limit}`
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch subscriptions");
      }
      return response.json();
    },
    enabled: !!user,
  });

  // Cancel subscription mutation
  const cancelSubscription = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const response = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subscriptionId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to cancel subscription");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch the subscriptions query
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      toast({
        title: "Subscription canceled",
        description: "Your subscription auto-renewal has been disabled",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    },
  });

  return {
    subscriptions: data?.subscriptions || [],
    meta: data?.meta,
    isLoading,
    error,
    refetch,
    cancelSubscription: cancelSubscription.mutate,
    isCanceling: cancelSubscription.isPending,
  };
} 