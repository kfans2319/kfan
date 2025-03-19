import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Utility function to determine content type from URL
function getContentTypeFromUrl(url: string): string | null {
  try {
    // Extract extension from URL
    const extension = url.split('.').pop()?.toLowerCase();
    if (!extension) return null;
    
    // Map extensions to MIME types
    const mimeTypes: Record<string, string> = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    
    return mimeTypes[extension] || null;
  } catch (error) {
    console.error("Error determining content type from URL:", error);
    return null;
  }
}

// Generate different URL variations for a given URL
function generateUrlVariations(url: string): string[] {
  const variations = [url]; // Start with the original
  
  // Handle specific patterns for uploadthing
  if (url.includes('t8x8bguwl4.ufs.sh')) {
    const withoutProtocol = url.replace(/^https?:\/\//, '');
    const parts = withoutProtocol.split('/');
    const domain = parts[0];
    
    // Extract the file ID (usually the last part)
    const fileId = parts[parts.length - 1];
    
    // Add variations
    variations.push(
      `https://${domain}/f/${fileId}`,
      `https://${domain}/a/${fileId}`,
      `https://${domain}/file/${fileId}`,
      `https://${domain}/v/${fileId}`,
      `https://${domain}/video/${fileId}`
    );
    
    // Special handling for the problematic video ID
    if (url.includes('5e7d80aa-602b-4dd3-9298-f9f173a8d4ac-p7ovvf.mp4')) {
      // Try different CDN domains for this specific video
      variations.push(
        `https://utfs.io/f/5e7d80aa-602b-4dd3-9298-f9f173a8d4ac-p7ovvf.mp4`,
        `https://cdn.uploadthing.com/f/5e7d80aa-602b-4dd3-9298-f9f173a8d4ac-p7ovvf.mp4`
      );
    }
  }
  
  // Handle standard UploadThing patterns
  if (url.includes('/a/')) {
    variations.push(url.replace('/a/', '/f/'));
  }
  if (url.includes('/f/')) {
    variations.push(url.replace('/f/', '/a/'));
  }
  if (url.includes('/a/t8x8bguwl4/')) {
    variations.push(
      url.replace('/a/t8x8bguwl4/', '/f/'),
      url.replace('/a/t8x8bguwl4/', '/a/'),
      url.replace('/a/t8x8bguwl4/', '/')
    );
  }
  
  return variations;
}

// Custom fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * This proxy allows us to serve media files from external sources 
 * that may have CORS restrictions.
 * 
 * Usage: /api/media-proxy?url=https://example.com/video.mp4
 */
export async function GET(request: NextRequest) {
  // Get the URL from the query parameters
  const url = request.nextUrl.searchParams.get("url");
  
  // If no URL is provided, return an error
  if (!url) {
    return NextResponse.json(
      { error: "No URL provided" },
      { status: 400 }
    );
  }

  try {
    // Log attempt to fetch media
    console.log("Media proxy attempting to fetch:", url);
    
    // Try to determine content type from URL
    const urlContentType = getContentTypeFromUrl(url);
    if (urlContentType) {
      console.log(`Detected content type from URL: ${urlContentType}`);
    }

    // Generate URL variations to try
    const urlVariations = generateUrlVariations(url);
    console.log(`Generated ${urlVariations.length} URL variations to try`);
    
    // Try each URL variation until one works
    let response = null;
    let targetUrl = url;
    let success = false;

    for (const variation of urlVariations) {
      try {
        console.log(`Trying URL variation: ${variation}`);
        
        // First do a HEAD request to see if the URL is accessible
        try {
          const headResponse = await fetchWithTimeout(
            variation, 
            {
              method: 'HEAD',
              headers: { "User-Agent": "Mozilla/5.0 (compatible; Proxy)" }
            },
            3000 // 3 second timeout for HEAD requests
          );
          
          if (headResponse.ok) {
            console.log(`Found working URL variation with HEAD check: ${variation}`);
            targetUrl = variation;
            success = true;
            break;
          } else {
            console.log(`HEAD check failed for ${variation}: ${headResponse.status}`);
          }
        } catch (headError) {
          console.log(`HEAD check error for ${variation}: ${(headError as Error).message}`);
          // Continue to the next variation or try a GET if all variations fail HEAD
        }
      } catch (error) {
        console.log(`Failed to fetch URL variation: ${variation}`);
      }
    }
    
    // If no variation worked with HEAD, try a direct GET for each one
    if (!success) {
      console.log("No HEAD request succeeded, trying GET requests...");
      
      for (const variation of urlVariations) {
        try {
          console.log(`Trying direct GET for: ${variation}`);
          response = await fetchWithTimeout(
            variation, 
            {
              headers: { "User-Agent": "Mozilla/5.0 (compatible; Proxy)" }
            },
            8000 // 8 second timeout for GET requests
          );
          
          if (response.ok) {
            console.log(`Found working URL variation with GET: ${variation}`);
            targetUrl = variation;
            success = true;
            break;
          }
        } catch (error) {
          console.log(`GET request failed for ${variation}: ${(error as Error).message}`);
        }
      }
    }
    
    // If we found a working URL in HEAD checks, now make the actual request
    if (success && !response) {
      try {
        response = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Proxy)"
          }
        });
      } catch (error) {
        console.error(`Error fetching successful targetUrl: ${targetUrl}`, error);
      }
    }

    // If nothing worked, try one more time with the original URL as a last resort
    if (!response || !response.ok) {
      console.log("All variations failed, trying original URL as last resort");
      
      try {
        response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Proxy)"
          }
        });
      } catch (error) {
        console.error(`Final attempt with original URL failed: ${url}`, error);
      }
    }

    // If we still don't have a working response, return an error
    if (!response || !response.ok) {
      console.error(`Media proxy failed to fetch any working URL variation`);
      return NextResponse.json(
        { 
          error: `Failed to fetch media from any URL variation`, 
          triedUrls: urlVariations 
        },
        { status: 404 }
      );
    }

    // Get the binary data
    const blob = await response.blob();
    
    // Determine content type - prefer header, fall back to URL detection
    let contentType = response.headers.get("content-type");
    
    if (!contentType || contentType === "application/octet-stream") {
      // If the server didn't provide a useful content type, try to determine it from the URL
      contentType = urlContentType || "application/octet-stream";
    }
    
    // For videos that are commonly mistyped
    if (targetUrl.includes('.mp4') && (contentType === "application/octet-stream" || !contentType)) {
      contentType = "video/mp4";
    } else if (targetUrl.includes('.mov') && (contentType === "application/octet-stream" || !contentType)) {
      contentType = "video/quicktime";
    }
    
    // Log successful fetch
    console.log(`Media proxy successfully fetched ${targetUrl}`);
    console.log(`Using content type: ${contentType}`);

    // Return the file with appropriate headers
    return new NextResponse(blob, {
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
        // Add headers to help debug
        "X-Original-Url": url,
        "X-Successful-Url": targetUrl
      }
    });
  } catch (error) {
    console.error("Media proxy error:", error);
    return NextResponse.json(
      { error: "Failed to proxy media", message: (error as Error).message },
      { status: 500 }
    );
  }
} 