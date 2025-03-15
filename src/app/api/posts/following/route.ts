import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getPostDataInclude, PostsPage } from "@/lib/types";
import { NextRequest } from "next/server";

// Cache for recent posts to avoid repeated DB fetches
const CACHE_TTL = 30 * 1000; // 30 seconds
let postsCache = {
  data: null as PostsPage | null,
  timestamp: 0,
  cursor: null as string | null
};

// Function to ensure consistent URL format for media
function ensureCorrectMediaUrls(posts: any[]) {
  return posts.map(post => {
    if (post.attachments && post.attachments.length > 0) {
      post.attachments = post.attachments.map((attachment: any) => {
        // If URL contains /f/ (instead of /a/), fix it
        if (attachment.url && 
            attachment.url.includes('/f/') && 
            process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID) {
          attachment.url = attachment.url.replace(
            "/f/",
            `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`
          );
        }
        return attachment;
      });
    }
    return post;
  });
}

export async function GET(req: NextRequest) {
  try {
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const pageSize = 10;

    const { user } = await validateRequest();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // If we have a cached first page and no cursor is provided (initial load)
    // and the cache is still fresh, return the cached data
    if (!cursor && postsCache.data && Date.now() - postsCache.timestamp < CACHE_TTL) {
      return Response.json(postsCache.data);
    }

    // Get followed users and subscriptions in a single parallel operation
    const [followedUsersResult, subscriptionsResult] = await Promise.all([
      // Get users that the current user is following
      prisma.follow.findMany({
        where: { followerId: user.id },
        select: { followingId: true },
      }),
      
      // Get subscriptions to check if the user is subscribed to any followed users
      prisma.subscription.findMany({
        where: { 
          subscriberId: user.id,
        },
        include: {
          tier: { select: { creatorId: true } },
        },
      })
    ]);

    const followedUserIds = followedUsersResult.map(follow => follow.followingId);
    
    // Use a more optimized query with select fields that are actually needed
    const posts = await prisma.post.findMany({
      where: {
        userId: {
          in: followedUserIds,
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
      include: getPostDataInclude(user.id),
    });

    const nextCursor = posts.length > pageSize ? posts[pageSize].id : null;
    
    // Process posts to ensure correct media URLs
    const processedPosts = ensureCorrectMediaUrls(posts.slice(0, pageSize));
    
    const result = {
      posts: processedPosts,
      nextCursor,
    };

    // Update cache if this is the first page
    if (!cursor) {
      postsCache = {
        data: result,
        timestamp: Date.now(),
        cursor: null
      };
    }

    return Response.json(result);
  } catch (error) {
    console.error("Following Feed Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
