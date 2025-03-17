"use client";

import { cn, formatRelativeDate } from "@/lib/utils";
import Link from "next/link";
import UserAvatar from "../UserAvatar";
import LikeButton from "./LikeButton";
import { MessageSquare, GlobeIcon } from "lucide-react";
import Linkify from "../Linkify";
import { PostData } from "@/lib/types";
import PostMoreButton from "./PostMoreButton";
import { useSubscriptionCheck } from "@/hooks/useSubscriptionCheck";
import PremiumContent from "../PremiumContent";
import { useContext, useState } from "react";
import { PostContext } from "@/lib/context";
import { useSession } from "@/app/(main)/SessionProvider";
import BookmarkButton from "./BookmarkButton";
import Comments from "../comments/Comments";

interface PostProps {
  post: PostData;
}

export default function Post({ post }: PostProps) {
  const { user } = useSession();
  const [showComments, setShowComments] = useState(false);

  return (
    <PostContext.Provider value={post}>
      <article className="group/post space-y-3 rounded-2xl bg-card p-5 shadow-sm">
        <div className="flex justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <Link href={`/users/${post.user.username}`}>
              <UserAvatar avatarUrl={post.user.avatarUrl} />
            </Link>
            <div>
              <Link
                href={`/users/${post.user.username}`}
                className="block font-medium hover:underline"
              >
                {post.user.displayName}
              </Link>
              <div className="flex items-center gap-2">
                <Link
                  href={`/posts/${post.id}`}
                  className="text-sm text-muted-foreground hover:underline"
                  suppressHydrationWarning
                >
                  {/* {formatRelativeDate(post.createdAt)} */}
                </Link>
                {post.isPublic && (
                  <span className="flex items-center text-xs text-muted-foreground">
                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500"></span>
                    Public
                  </span>
                )}
              </div>
            </div>
          </div>
          {user && post.user.id === user.id && (
            <PostMoreButton
              post={post}
              className="opacity-0 transition-opacity group-hover/post:opacity-100"
            />
          )}
        </div>
        <Linkify>
          <div className="whitespace-pre-line break-words">{post.content}</div>
        </Linkify>
        {!!post.attachments.length && (
          <MediaPreviews 
            attachments={post.attachments} 
            postUserId={post.user.id} 
            postUserUsername={post.user.username} 
            postIsPublic={!!post.isPublic}
          />
        )}
        <hr className="text-muted-foreground" />
        <div className="flex justify-between gap-5">
          <div className="flex items-center gap-5">
            <LikeButton
              postId={post.id}
              initialState={{
                likes: post._count.likes,
                isLikedByUser: post.likes ? post.likes.length > 0 : false,
              }}
            />
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-2 text-muted-foreground"
            >
              <MessageSquare
                className={showComments ? "text-primary" : ""}
                size={16}
              />
              <span>{post._count.comments}</span>
            </button>
          </div>
          <BookmarkButton
            postId={post.id}
            initialState={{ isBookmarkedByUser: post.bookmarks ? post.bookmarks.length > 0 : false }}
          />
        </div>
        {showComments && <Comments post={post} />}
      </article>
    </PostContext.Provider>
  );
}

interface MediaPreviewsProps {
  attachments: PostData["attachments"];
  postUserId: string;
  postUserUsername: string;
  postIsPublic: boolean;
}

function MediaPreviews({ attachments, postUserId, postUserUsername, postIsPublic }: MediaPreviewsProps) {
  // Get the parent post from the context
  const post = useContext(PostContext);
  
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        attachments.length > 1 && "sm:grid sm:grid-cols-2",
      )}
    >
      {attachments.map((m) => (
        <MediaPreview 
          key={m.id} 
          media={m} 
          creatorId={postUserId} 
          creatorUsername={postUserUsername} 
          postIsPublic={postIsPublic}
        />
      ))}
    </div>
  );
}

interface MediaPreviewProps {
  media: any;
  creatorId: string;
  creatorUsername: string;
  postIsPublic: boolean;
}

function MediaPreview({ media, creatorId, creatorUsername, postIsPublic }: MediaPreviewProps) {
  const { user } = useSession();
  const { isSubscribed } = useSubscriptionCheck(creatorId);
  const [imageError, setImageError] = useState(false);
  
  // Show media if it's a public post, user is the creator, or user is subscribed
  const showActualMedia = postIsPublic || user?.id === creatorId || isSubscribed;
  
  // Function to ensure the URL is using the correct format
  const getProperMediaUrl = (url: string) => {
    // If URL already contains /a/ (UploadThing asset URL format), use it as is
    if (url.includes('/a/')) {
      return url;
    }
    
    // If URL contains /f/ (UploadThing file URL format), replace it
    if (url.includes('/f/') && process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID) {
      return url.replace(
        "/f/",
        `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`
      );
    }
    
    // Return original URL if no transformation needed
    return url;
  };

  if (!showActualMedia) {
    return <PremiumContent mediaType={media.type} creatorUsername={creatorUsername} />;
  }

  if (media.type === "IMAGE") {
    return (
      <div className="relative w-full">
        {imageError ? (
          <div className="flex h-64 w-full items-center justify-center rounded-md bg-muted">
            <p className="text-sm text-muted-foreground">Failed to load image</p>
          </div>
        ) : (
          <img
            src={getProperMediaUrl(media.url)}
            alt="Post image"
            className="h-auto w-full rounded-md object-cover"
            loading="lazy"
            onError={() => {
              console.error(`Failed to load image: ${media.url}`);
              setImageError(true);
            }}
          />
        )}
      </div>
    );
  }

  if (media.type === "VIDEO") {
    return (
      <video
        src={getProperMediaUrl(media.url)}
        controls
        className="h-auto w-full rounded-md object-cover"
        preload="metadata"
        onError={(e) => console.error(`Video load error: ${e}`)}
      />
    );
  }

  return null;
}
