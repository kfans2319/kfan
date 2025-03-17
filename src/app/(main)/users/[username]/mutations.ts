import { useToast } from "@/components/ui/use-toast";
import { PostsPage } from "@/lib/types";
import { useUploadThing } from "@/lib/uploadthing";
import { UpdateUserProfileValues } from "@/lib/validation";
import {
  InfiniteData,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { updateUserProfile } from "./actions";

export function useUpdateProfileMutation() {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { startUpload: startAvatarUpload } = useUploadThing("avatar");
  const { startUpload: startBannerUpload } = useUploadThing("bannerImage");

  const mutation = useMutation({
    mutationFn: async ({
      values,
      avatar,
      banner,
    }: {
      values: UpdateUserProfileValues;
      avatar?: File;
      banner?: File;
    }) => {
      return Promise.all([
        updateUserProfile(values),
        avatar && startAvatarUpload([avatar]),
        banner && startBannerUpload([banner]),
      ]);
    },
    onSuccess: async ([updatedUser, avatarUploadResult, bannerUploadResult]) => {
      const newAvatarUrl = avatarUploadResult?.[0]?.serverData.avatarUrl;
      const newBannerUrl = bannerUploadResult?.[0]?.serverData.bannerImageUrl;

      // Define the query filter
      const queryFilter = {
        queryKey: ["post-feed"],
      };

      await queryClient.cancelQueries(queryFilter);

      // Type assertion approach to fix the TypeScript error
      queryClient.setQueriesData<InfiniteData<PostsPage, string | null>>(
        queryFilter,
        (oldData) => {
          if (!oldData) return undefined;
          
          // Create a deep copy to avoid mutation
          const newData = JSON.parse(JSON.stringify(oldData)) as typeof oldData;
          
          // Update the user data in all posts
          newData.pages.forEach(page => {
            page.posts.forEach(post => {
              if (post.user.id === updatedUser.id) {
                // Update only the specific fields we know have changed
                post.user.avatarUrl = newAvatarUrl || updatedUser.avatarUrl;
                post.user.bannerImageUrl = newBannerUrl || updatedUser.bannerImageUrl;
                post.user.displayName = updatedUser.displayName;
                post.user.username = updatedUser.username;
                post.user.bio = updatedUser.bio;
              }
            });
          });
          
          return newData;
        },
      );

      router.refresh();

      toast({
        description: "Profile updated",
      });
    },
    onError(error) {
      console.error(error);
      toast({
        variant: "destructive",
        description: "Failed to update profile. Please try again.",
      });
    },
  });

  return mutation;
}
