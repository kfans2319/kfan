import LikeButton from "@/components/posts/LikeButton";
import { PostData } from "@/lib/types";

interface PostActionProps {
  post: PostData;
}

export function PostLikeButton({ post }: PostActionProps) {
  return (
    <LikeButton
      initialState={{
        likes: post._count.likes,
        isLikedByUser: post._count.likes > 0,
      }}
      postId={post.id}
    />
  );
} 