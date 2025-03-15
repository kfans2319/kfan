import { useState, useEffect } from 'react';

/**
 * Custom hook that checks if a media query matches the current window size
 * 
 * @param query The media query to match
 * @returns boolean indicating whether the media query matches
 */
export function useMediaQuery(query: string): boolean {
  // Default to false while on the server
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Initialize with the match state on client-side
    const media = window.matchMedia(query);
    setMatches(media.matches);

    // Create a listener to update the state when the match changes
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add the listener
    media.addEventListener('change', listener);

    // Clean up the listener when the component unmounts
    return () => {
      media.removeEventListener('change', listener);
    };
  }, [query]);

  return matches;
} 