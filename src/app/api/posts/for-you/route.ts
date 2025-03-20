import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getPostDataInclude, PostsPage } from "@/lib/types";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

// Cache for recent posts to avoid repeated DB fetches
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache
const QUERY_TIMEOUT = 15 * 1000; // Increased to 15 seconds to prevent timeouts
const DEFAULT_PAGE_SIZE = 3; // Further reduced for even faster initial load
const MAX_PAGE_SIZE = 10; // Reduced maximum page size

// Cache structure with separate entries for different cursors
interface CacheEntry {
  data: PostsPage;
  timestamp: number;
}

const postsCache: Record<string, CacheEntry> = {
  initial: {
    data: { posts: [], nextCursor: null },
    timestamp: 0
  }
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

// Helper function to create a timeout promise
function createTimeoutPromise(ms: number) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
  });
}

export async function GET(req: NextRequest) {
  // Set up response headers for better client handling
  const headers = {
    'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
    'Content-Type': 'application/json',
  };

  try {
    // Force cache busting
    const forceRefresh = true; // Always force a refresh for now
    
    // Check if this is a client-auth request (after fresh login)
    const isClientAuth = req.headers.get('x-client-auth') === 'true';
    // Get the cache busting parameter if any
    const authTs = req.nextUrl.searchParams.get('_auth');
    
    // Parse query parameters with defaults and validation
    // For randomized feed, we're using page parameter instead of cursor
    const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
    const requestedPageSize = parseInt(req.nextUrl.searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE));
    const pageSize = Math.min(Math.max(1, requestedPageSize), MAX_PAGE_SIZE);
    
    // Generate cache key, include auth timestamp for client auth requests
    const cacheKey = isClientAuth && authTs 
      ? `random-${authTs}-page-${page}`
      : `random-${Date.now()}-page-${page}`; // Use timestamp for random feeds
    
    // Authentication check
    const { user } = await validateRequest();
    if (!user) {
      console.log("For-you feed: User authentication failed");
      return Response.json({ 
        error: "Unauthorized",
        message: "User authentication failed. Please log in."
      }, { status: 401, headers });
    }
    
    console.log(`For-you feed: User authenticated successfully. User ID: ${user.id.substring(0, 8)}..., Client auth: ${isClientAuth}`);

    try {
      // Always get fresh data for debugging
      console.log("For-you feed: Forcing fresh data fetch");
      const result = await getFastPosts(user.id, page, pageSize, cacheKey);
      return Response.json({
        ...result,
        _fresh: true
      }, { headers });
    } catch (fetchError) {
      console.error("For-you feed: Primary fetch failed, trying fallback with simpler query", fetchError);
      
      // If we get a timeout, try a simpler query with fewer joins
      if (fetchError instanceof Error && fetchError.message.includes("timeout")) {
        try {
          // Try an even simpler query with minimal joins and fewer posts
          const fallbackResult = await getFallbackPosts(user.id, page, Math.min(pageSize, 3));
          console.log("For-you feed: Fallback query succeeded");
          return Response.json({
            ...fallbackResult,
            _fallback: true
          }, { headers });
        } catch (fallbackError) {
          console.error("For-you feed: Fallback query also failed", fallbackError);
          // Continue to general error handler
          throw fallbackError;
        }
      }
      
      // If it wasn't a timeout or the fallback failed, rethrow
      throw fetchError;
    }
    
  } catch (error) {
    console.error("For You Feed Error:", error);
    
    // Check if this is an authentication error
    if (error instanceof Error && error.message.includes("auth")) {
      return Response.json({
        posts: [],
        nextCursor: null,
        _error: "Authentication failed",
        _errorDetails: "Please log in again"
      }, { status: 401, headers });
    }
    
    // Check if this is a timeout error
    if (error instanceof Error && error.message.includes("timeout")) {
      return Response.json({
        posts: [],
        nextCursor: null,
        _error: "Server timeout",
        _errorDetails: "The server took too long to respond. Please try again later."
      }, { status: 200, headers });
    }
    
    // Emergency fallback
    return Response.json({ 
      posts: [], 
      nextCursor: null,
      _error: "Could not load posts",
      _errorDetails: error instanceof Error ? error.message : "Unknown error"
    }, { status: 200, headers }); // Return 200 even on error for better UX
  }
}

// Background cache refresh - fire and forget
async function refreshCacheInBackground(userId: string, page: number, pageSize: number, cacheKey: string): Promise<void> {
  try {
    const result = await getFastPosts(userId, page, pageSize, cacheKey);
    console.log(`Background refresh completed for ${cacheKey}`);
  } catch (error) {
    console.error("Background refresh failed:", error);
  }
}

// Simplified fast post fetching function
async function getFastPosts(userId: string, page: number, pageSize: number, cacheKey: string): Promise<PostsPage> {
  try {
    // Clear any potential cached data for this key
    delete postsCache[cacheKey];
    
    console.log(`DEBUG: Starting for-you feed fetch for user ${userId.substring(0, 8)}`);
    console.log(`DEBUG: Using cache key: ${cacheKey}`);
    
    // SUPER SIMPLIFIED QUERY - GET ALL POSTS WITH MINIMAL FILTERING
    // This is a troubleshooting step to see if we can get all posts
    
    // Use a minimal include to speed up the query
    const simpleInclude = {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true
        }
      },
      attachments: true,
      likes: {
        where: {
          userId: userId
        },
        take: 1
      },
      bookmarks: {
        where: {
          userId: userId
        },
        take: 1
      },
      _count: {
        select: {
          likes: true,
          comments: true
        }
      }
    };

    console.log(`DEBUG: Executing raw query to get ALL posts`);

    // Run with a strict timeout, but get ALL posts using raw SQL for randomization
    const posts = await Promise.race([
      prisma.$queryRaw`
        SELECT p.*, 
               u.id as "userId", 
               u.username as "userName", 
               u.displayName as "userDisplayName", 
               u.avatarUrl as "userAvatarUrl" 
        FROM "Post" p
        JOIN "User" u ON p."userId" = u.id
        ORDER BY RANDOM()
        LIMIT ${pageSize}
        OFFSET ${(page - 1) * pageSize}
      `,
      createTimeoutPromise(QUERY_TIMEOUT)
    ]) as any[];

    console.log(`DEBUG: Raw query returned ${posts.length} posts`);
    
    // Format posts to match the expected structure
    const formattedPosts = posts.map(post => ({
      ...post,
      user: {
        id: post.userId,
        username: post.userName,
        displayName: post.userDisplayName,
        avatarUrl: post.userAvatarUrl
      },
      likes: [],
      bookmarks: [],
      attachments: [],
      _count: {
        likes: 0,
        comments: 0
      }
    }));
    
    // Process posts to ensure correct media URLs
    const processedPosts = ensureCorrectMediaUrls(formattedPosts);
    
    // Determine next cursor - now using page numbers
    // For random posts, we'll always have a next page unless we got fewer posts than requested
    const hasNextPage = processedPosts.length >= pageSize;
    
    // Prepare the result with next page info
    const result = {
      posts: processedPosts,
      nextCursor: hasNextPage ? `${page + 1}` : null,
    };

    // Update cache
    postsCache[cacheKey] = {
      data: result,
      timestamp: Date.now()
    };

    return result;
  } catch (error) {
    console.error("Error in getFastPosts:", error);
    throw error;
  }
}

// Extremely simplified fallback for when the main query times out
async function getFallbackPosts(userId: string, page: number, pageSize: number): Promise<PostsPage> {
  try {
    console.log(`DEBUG: Starting fallback post fetch for user ${userId.substring(0, 8)}`);
    
    // Get the date 7 days ago
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Run with an extended timeout, but using raw SQL for randomization
    const posts = await Promise.race([
      prisma.$queryRaw`
        SELECT p.*, 
               u.id as "userId", 
               u.username as "userName", 
               u.displayName as "userDisplayName", 
               u.avatarUrl as "userAvatarUrl" 
        FROM "Post" p
        JOIN "User" u ON p."userId" = u.id
        WHERE p."createdAt" >= ${sevenDaysAgo}::timestamp
        ORDER BY RANDOM()
        LIMIT ${pageSize}
        OFFSET ${(page - 1) * pageSize}
      `,
      createTimeoutPromise(QUERY_TIMEOUT * 1.5) // Give it 50% more time
    ]) as any[];

    console.log(`DEBUG: Fallback query returned ${posts.length} posts`);
    
    // Format posts to match the expected structure
    const formattedPosts = posts.map(post => ({
      ...post,
      user: {
        id: post.userId,
        username: post.userName,
        displayName: post.userDisplayName,
        avatarUrl: post.userAvatarUrl
      }
    }));
    
    // Determine if there's a next page - for random posts, we'll always have a next page
    // unless we got fewer posts than requested
    const hasNextPage = formattedPosts.length >= pageSize;
    
    // Return the simplified posts
    return {
      posts: formattedPosts,
      nextCursor: hasNextPage ? `${page + 1}` : null,
    };
  } catch (error) {
    console.error("Error in fallback post fetch:", error);
    throw error;
  }
}
