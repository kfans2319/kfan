import { useSession } from "@/app/(main)/SessionProvider";
import { useToast } from "@/components/ui/use-toast";
import { PostsPage } from "@/lib/types";
import {
  InfiniteData,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { submitPost } from "./actions";

export function useSubmitPostMutation() {
  const { toast } = useToast();

  const queryClient = useQueryClient();

  const { user } = useSession();

  const mutation = useMutation({
    mutationFn: submitPost,
    onSuccess: async (newPost) => {
      // Define query keys we want to update
      const forYouQueryKey = ["post-feed", "for-you"];
      const userPostsQueryKey = ["post-feed", "user-posts", user.id];
      
      // Cancel queries for both keys
      await queryClient.cancelQueries({ queryKey: forYouQueryKey });
      await queryClient.cancelQueries({ queryKey: userPostsQueryKey });

      // Update for-you feed
      queryClient.setQueriesData<InfiniteData<PostsPage, string | null>>(
        { queryKey: forYouQueryKey },
        (oldData) => {
          if (!oldData || !oldData.pages[0]) return oldData;
          
          // Create a deep copy to avoid mutation
          const newData = JSON.parse(JSON.stringify(oldData)) as typeof oldData;
          
          // Update the first page with the new post
          newData.pages[0] = {
            ...newData.pages[0],
            posts: [newPost, ...newData.pages[0].posts],
          };
          
          return newData;
        },
      );
      
      // Update user posts feed
      queryClient.setQueriesData<InfiniteData<PostsPage, string | null>>(
        { queryKey: userPostsQueryKey },
        (oldData) => {
          if (!oldData || !oldData.pages[0]) return oldData;
          
          // Create a deep copy to avoid mutation
          const newData = JSON.parse(JSON.stringify(oldData)) as typeof oldData;
          
          // Update the first page with the new post
          newData.pages[0] = {
            ...newData.pages[0],
            posts: [newPost, ...newData.pages[0].posts],
          };
          
          return newData;
        },
      );

      // Invalidate queries that don't have data yet
      queryClient.invalidateQueries({ 
        queryKey: forYouQueryKey,
        refetchType: 'none'
      });
      
      queryClient.invalidateQueries({ 
        queryKey: userPostsQueryKey,
        refetchType: 'none'
      });

      toast({
        description: "Post created",
      });
    },
    onError(error) {
      console.error(error);
      toast({
        variant: "destructive",
        description: "Failed to post. Please try again.",
      });
    },
  });

  return mutation;
}
