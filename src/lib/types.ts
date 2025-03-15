import { Prisma } from "@prisma/client";

export function getUserDataSelect(loggedInUserId?: string): Prisma.UserSelect {
  return {
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
    bannerImageUrl: true,
    bio: true,
    createdAt: true,
    isAdmin: true,
    isVerified: true,
    verificationStatus: true,
    verificationPose: true,
    verificationSubmittedAt: true,
    selfieImageUrl: true,
    idImageUrl: true,
    verificationProcessedAt: true,
    verificationProcessedById: true,
    createdTiers: {
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        creatorId: true,
        // @ts-ignore - duration field exists in database but not in generated types yet
        duration: true
      }
    },
    followers: loggedInUserId ? {
      where: {
        followerId: loggedInUserId,
      },
      select: {
        followerId: true,
      },
    } : undefined,
    _count: {
      select: {
        followers: true,
        posts: true,
      },
    },
  };
}

export type UserData = Prisma.UserGetPayload<{ select: ReturnType<typeof getUserDataSelect> }> & {
  bannerImageUrl?: string | null;
};

type PostInclude = {
  user: { select: ReturnType<typeof getUserDataSelect> };
  attachments: boolean;
  likes: { where: { userId: string }; take: number };
  bookmarks: { where: { userId: string }; take: number }; 
  comments: {
    orderBy: { createdAt: Prisma.SortOrder };
    include: { user: { select: ReturnType<typeof getUserDataSelect> } };
    take: number;
  };
  _count: { select: { likes: boolean; comments: boolean } };
}

export function getPostDataInclude(
  loggedInUserId: string, 
  options?: { exclude?: (keyof PostInclude)[] }
): PostInclude {
  const include: PostInclude = {
    user: {
      select: getUserDataSelect(loggedInUserId),
    },
    attachments: true,
    likes: {
      where: {
        userId: loggedInUserId,
      },
      take: 1,
    },
    bookmarks: {
      where: {
        userId: loggedInUserId,
      },
      take: 1,
    },
    comments: {
      orderBy: { createdAt: Prisma.SortOrder.asc },
      include: {
        user: {
          select: getUserDataSelect(loggedInUserId),
        },
      },
      take: 3,
    },
    _count: {
      select: {
        likes: true,
        comments: true,
      },
    },
  };

  if (options?.exclude) {
    options.exclude.forEach((field) => delete include[field]);
  }

  return include;
}

export type PostData = Prisma.PostGetPayload<{ include: PostInclude }>;

export interface PostsPage {
  posts: PostData[];
  nextCursor: string | null;
  // Optional properties for error handling
  _error?: boolean;
  _empty?: boolean;
  _cached?: boolean;
  _cacheAge?: number;
  _clientError?: string;
  _errorDetails?: string;
}

export function getCommentDataInclude(loggedInUserId: string) {
  return {
    user: {
      select: getUserDataSelect(loggedInUserId),
    },
  } satisfies Prisma.CommentInclude;
}

export type CommentData = Prisma.CommentGetPayload<{
  include: ReturnType<typeof getCommentDataInclude>;
}>;

export interface CommentsPage {
  comments: CommentData[];
  previousCursor: string | null;
}

export const notificationsInclude = {
  issuer: {
    select: {
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  },
  post: {
    select: {
      content: true,
    },
  },
} satisfies Prisma.NotificationInclude;

export type NotificationData = Prisma.NotificationGetPayload<{
  include: typeof notificationsInclude;
}>;

export interface NotificationsPage {
  notifications: NotificationData[];
  nextCursor: string | null;
}

export interface FollowerInfo {
  followers: number;
  isFollowedByUser: boolean;
}

export interface LikeInfo {
  likes: number;
  isLikedByUser: boolean;
}

export interface BookmarkInfo {
  isBookmarkedByUser: boolean;
}

export interface NotificationCountInfo {
  unreadCount: number;
}

export interface MessageCountInfo {
  unreadCount: number;
}
