import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Utility endpoint to check if a media URL is accessible and get information about it
 * Usage: /api/check-media?url=https://example.com/video.mp4
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
    console.log("Checking media URL:", url);
    
    // Generate variations of the URL to test
    const fileExtension = url.split('.').pop()?.toLowerCase();
    const isUploadThingUrl = url.includes('t8x8bguwl4.ufs.sh') || 
                             url.includes('uploadthing') || 
                             url.includes('utfs.io');
    
    // Create variations to test
    const urlVariations = [url];
    
    if (isUploadThingUrl) {
      // Add common UploadThing URL variations
      if (url.includes('/a/')) {
        urlVariations.push(url.replace('/a/', '/f/'));
      }
      if (url.includes('/f/')) {
        urlVariations.push(url.replace('/f/', '/a/'));
      }
      if (url.includes('/a/t8x8bguwl4/')) {
        urlVariations.push(url.replace('/a/t8x8bguwl4/', '/f/'));
        urlVariations.push(url.replace('/a/t8x8bguwl4/', '/a/'));
      }
    }
    
    // Test each URL variation
    const results = await Promise.all(
      urlVariations.map(async (testUrl) => {
        try {
          const startTime = Date.now();
          const response = await fetch(testUrl, { method: 'HEAD' });
          const endTime = Date.now();
          
          return {
            url: testUrl,
            status: response.status,
            ok: response.ok,
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length'),
            responseTime: endTime - startTime,
          };
        } catch (error) {
          return {
            url: testUrl,
            error: (error as Error).message,
            status: 'error',
            ok: false
          };
        }
      })
    );
    
    return NextResponse.json({
      originalUrl: url,
      fileExtension,
      isUploadThingUrl,
      results
    });
  } catch (error) {
    console.error("Error checking media:", error);
    return NextResponse.json(
      { error: "Failed to check media" },
      { status: 500 }
    );
  }
} 