"use client";

import InfiniteScrollContainer from "@/components/InfiniteScrollContainer";
import Post from "@/components/posts/Post";
import PostsLoadingSkeleton from "@/components/posts/PostsLoadingSkeleton";
import kyInstance from "@/lib/ky";
import { PostsPage } from "@/lib/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { memo, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSession } from "./SessionProvider";

function ForYouFeed() {
  const [retryCount, setRetryCount] = useState(0);
  const session = useSession();
  const { user, _sessionLoadTime } = session;
  // Start with true to avoid flash of loading state after login
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const hasMounted = useRef(false);
  const [hasError, setHasError] = useState(false);
  
  // Track auth state with a stable reference
  const authStatusRef = useRef({
    userId: user?.id || '',
    isAuthenticated: true,
    initialized: false,
    sessionLoadTime: _sessionLoadTime || 0
  });

  // Update authentication state on mount and when user changes
  useEffect(() => {
    // Skip the first effect run if we have a user already
    if (!hasMounted.current) {
      hasMounted.current = true;
      // If we already have a user, keep authenticated state true
      if (user?.id) {
        authStatusRef.current = {
          userId: user.id,
          isAuthenticated: true,
          initialized: true,
          sessionLoadTime: _sessionLoadTime || 0
        };
        return;
      }
    }

    // Update the auth state based on user presence
    if (user?.id) {
      authStatusRef.current = {
        userId: user.id,
        isAuthenticated: true,
        initialized: true,
        sessionLoadTime: _sessionLoadTime || 0
      };
      setIsAuthenticated(true);
      console.log("User authenticated:", user.id.substring(0, 8), "Session load time:", _sessionLoadTime);
    } else {
      authStatusRef.current = {
        userId: '',
        isAuthenticated: false,
        initialized: true,
        sessionLoadTime: 0
      };
      setIsAuthenticated(false);
      console.log("No user found in session");
    }
  }, [user?.id, _sessionLoadTime]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["post-feed", "for-you", retryCount, user?.id, _sessionLoadTime],
    queryFn: async ({ pageParam }) => {
      try {
        console.log("Fetching for-you posts, auth status:", authStatusRef.current);
        // Calculate how fresh the session is
        const sessionAge = authStatusRef.current.sessionLoadTime 
          ? Date.now() - authStatusRef.current.sessionLoadTime 
          : 9999999;
            
        // Add the x-client-auth header if this is a fresh session (< 5 seconds old)
        const isFreshLogin = sessionAge < 5000;
        
        // For randomized feed, add a cache-busting timestamp for each page request
        const timestamp = Date.now();
        
        const response = await kyInstance
          .get(
            "/api/posts/for-you",
            {
              // Add a random parameter to ensure we get different posts each time
              searchParams: { 
                random: timestamp,
                // For randomized feed, we're not using cursor-based pagination anymore
                ...(pageParam ? { page: pageParam } : {}) 
              },
              timeout: 30000,
              retry: {
                limit: 3,
                methods: ['get'],
                statusCodes: [408, 413, 429, 500, 502, 503, 504, 401],
                backoffLimit: 10000,
              },
              headers: {
                // Add client auth header if this appears to be a fresh login
                ...(isFreshLogin ? { 'x-client-auth': 'true' } : {})
              }
            },
          )
          .json<PostsPage>();
        
        if (!response.posts || response.posts.length === 0) {
          console.log("Empty posts response, using fallback");
          return { posts: [], nextCursor: null, _empty: true };
        }
        
        setHasError(false);
        return response;
      } catch (error: any) {
        console.error("Error fetching for-you feed:", error);
        
        // More detailed error handling
        if (error.name === 'TimeoutError' || (error.message && error.message.includes('timeout'))) {
          console.log("Timeout detected, will retry with backoff");
          // Let the retry logic handle this case
        } else if (error.response?.status === 401) {
          // Auth error handling
          setTimeout(() => {
            console.log("Retrying after auth error");
            setRetryCount(count => count + 1);
          }, 500);
        } else if (error.name === 'NetworkError' || (error.message && (error.message.includes('network') || error.message.includes('connection')))) {
          console.log("Network error detected, check connection");
        }
        
        setHasError(true);
        
        // Show a more informative error message in the returned data
        return { 
          posts: [], 
          nextCursor: null, 
          _error: true,
          _errorType: error.name || 'unknown',
          _errorMessage: error.message || 'Unknown error occurred'
        };
      }
    },
    initialPageParam: 1, // Start with page 1
    getNextPageParam: (lastPage, allPages) => {
      // Since we're using randomized posts, we'll use page numbers instead of cursors
      // Only return the next page if we actually got posts in the last request
      return lastPage.posts.length > 0 ? allPages.length + 1 : undefined;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true, 
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * (2 ** attempt), 30000),
    refetchOnReconnect: true,
    // Use fixed value instead of depending on status
    refetchInterval: false,
  });

  // Set up error-based refetch interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (status === "error" || hasError) {
      // If there's an error, set up a 5-second retry interval
      interval = setInterval(() => {
        console.log("Error detected, auto-retrying...");
        refetch();
      }, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, hasError, refetch]);

  // Force a refetch when auth state changes
  useEffect(() => {
    if (authStatusRef.current.initialized && authStatusRef.current.isAuthenticated) {
      console.log("Auth state changed, triggering refetch");
      refetch();
    }
  }, [isAuthenticated, refetch]);

  // Try prefetching immediately on mount for fresh logins
  useEffect(() => {
    // Small delay to allow other state to initialize
    const timer = setTimeout(() => {
      if (_sessionLoadTime && Date.now() - _sessionLoadTime < 5000) {
        console.log("Fresh login detected, forcing initial fetch");
        refetch();
      } else if (status === "pending" && !isFetching && user?.id) {
        console.log("Forcing initial fetch");
        refetch();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [refetch, isFetching, status, user?.id, _sessionLoadTime]);

  const posts = data?.pages.flatMap((page) => page.posts) || [];
  const queryHasError = data?.pages.some(page => page._error) || status === "error";
  const isEmpty = posts.length === 0 && !isFetching && !hasNextPage;

  const handleRetry = () => {
    // Increment the retry count to force a data refresh
    setRetryCount(prev => prev + 1);
    
    // Clear the existing query data to force a fresh fetch
    // This ensures we get completely new random posts
    refetch();
  };

  // Show loading skeleton if we're in a pending state and not authenticated or have no posts yet
  if (status === "pending" && !posts.length) {
    return <PostsLoadingSkeleton />;
  }

  if (isEmpty && !queryHasError) {
    return (
      <div className="text-center p-6">
        <p className="text-muted-foreground mb-4">
          No posts to show right now. Follow some creators to see their content here.
        </p>
        <Button onClick={handleRetry} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>
    );
  }

  // Show partial data with an error notice if we have some posts but encountered an error
  return (
    <div className="space-y-5">
      {queryHasError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading some posts</AlertTitle>
          <AlertDescription className="flex justify-between items-center">
            <span>Some content couldn't be loaded</span>
            <Button onClick={handleRetry} variant="outline" size="sm" className="mt-2">
              <RefreshCw className="w-3 h-3 mr-1" /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Refresh button for random posts */}
      <div className="flex justify-center mb-2">
        <Button 
          onClick={handleRetry} 
          variant="outline" 
          size="sm"
          className="w-full sm:w-auto"
          disabled={isFetching}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> 
          {isFetching ? 'Refreshing...' : 'Get New Random Posts'}
        </Button>
      </div>

      <InfiniteScrollContainer
        className="space-y-5"
        onBottomReached={() => {
          if (hasNextPage && !isFetching) {
            fetchNextPage();
          }
        }}
      >
        {posts.map((post) => (
          <Post key={post.id} post={post} />
        ))}
        {isFetchingNextPage && <Loader2 className="mx-auto my-3 animate-spin" />}
        {isFetching && !isFetchingNextPage && posts.length === 0 && (
          <PostsLoadingSkeleton />
        )}
        
        {isEmpty && queryHasError && (
          <div className="text-center p-6">
            <p className="text-muted-foreground mb-4">
              We couldn't load any posts. Please check your connection and try again.
            </p>
            <Button onClick={handleRetry} variant="default" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </div>
        )}
      </InfiniteScrollContainer>
    </div>
  );
}

export default memo(ForYouFeed);
