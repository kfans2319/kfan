import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import streamServerClient from "@/lib/stream";
import { createUploadthing, FileRouter } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server";

const f = createUploadthing();

export const fileRouter = {
  avatar: f({
    image: { maxFileSize: "512KB" },
  })
    .middleware(async () => {
      const { user } = await validateRequest();

      if (!user) throw new UploadThingError("Unauthorized");

      return { user };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const oldAvatarUrl = metadata.user.avatarUrl;

      if (oldAvatarUrl) {
        const key = oldAvatarUrl.split(
          `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`,
        )[1];

        await new UTApi().deleteFiles(key);
      }

      const newAvatarUrl = file.url.replace(
        "/f/",
        `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`,
      );

      await Promise.all([
        prisma.user.update({
          where: { id: metadata.user.id },
          data: {
            avatarUrl: newAvatarUrl,
          },
        }),
        streamServerClient.partialUpdateUser({
          id: metadata.user.id,
          set: {
            image: newAvatarUrl,
          },
        }),
      ]);

      return { avatarUrl: newAvatarUrl };
    }),
  bannerImage: f({
    image: { maxFileSize: "2MB" },
  })
    .middleware(async () => {
      const { user } = await validateRequest();

      if (!user) throw new UploadThingError("Unauthorized");

      return { user };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const oldBannerUrl = (metadata.user as any).bannerImageUrl;

      if (oldBannerUrl) {
        const key = oldBannerUrl.split(
          `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`,
        )[1];

        await new UTApi().deleteFiles(key);
      }

      const newBannerUrl = file.url.replace(
        "/f/",
        `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`,
      );

      await prisma.$executeRaw`UPDATE users SET "bannerImageUrl" = ${newBannerUrl} WHERE id = ${metadata.user.id}`;

      return { bannerImageUrl: newBannerUrl };
    }),
  verification: f({
    image: { maxFileSize: "4MB", maxFileCount: 2 },
  })
    .middleware(async () => {
      const { user } = await validateRequest();

      if (!user) throw new UploadThingError("Unauthorized");

      console.log("Verification upload middleware: authenticated user", user.id);
      return { user };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Verification upload complete:", {
        fileUrl: file.url,
        fileType: file.type,
        fileName: file.name,
        userId: metadata.user.id,
      });
      
      const imageUrl = file.url.replace(
        "/f/",
        `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`,
      );

      // We'll handle storing the image URLs in the verification form submission
      // This just returns the URL to be used in the form
      return { 
        imageUrl,
        url: imageUrl, // Return both formats to ensure compatibility
      };
    }),
  attachment: f({
    image: { maxFileSize: "4MB", maxFileCount: 5 },
    video: { maxFileSize: "64MB", maxFileCount: 5 },
  })
    .middleware(async () => {
      const { user } = await validateRequest();

      if (!user) throw new UploadThingError("Unauthorized");

      console.log("Attachment upload middleware: processing media upload");
      return { user };
    })
    .onUploadComplete(async ({ file }) => {
      console.log("Attachment upload complete:", {
        fileUrl: file.url,
        fileType: file.type,
        fileName: file.name,
        fileSize: file.size,
        fileKey: file.key
      });
      
      // Determine media type with better detection
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      const isImage = file.type.startsWith("image");
      const isVideo = file.type.startsWith("video") || 
                    file.type === 'video/quicktime' ||
                    ['mov', 'mp4', 'webm', 'avi', 'mkv', 'wmv', 'm4v', 'qt'].includes(extension);
      
      // Log if this is a video file based on our detection
      if (isVideo) {
        console.log(`Detected video file: ${file.name} (${file.type}), extension: ${extension}`);
      }
      
      // Transform the URL - handle multiple cases
      let transformedUrl = file.url;
      
      // Store the original URL for reference
      const originalUrl = file.url;
      
      // Determine the most reliable URL format based on domain
      if (file.url.includes('t8x8bguwl4.ufs.sh')) {
        // For t8x8bguwl4.ufs.sh domain, we've found the /f/ format is often more reliable
        const fileId = file.url.split('/').pop(); // Get the file ID (last part of URL)
        if (fileId) {
          // For videos, especially MP4s on this domain, use the direct /f/ format
          if (isVideo) {
            transformedUrl = `https://t8x8bguwl4.ufs.sh/f/${fileId}`;
            console.log("For video on t8x8bguwl4, using direct /f/ URL format:", transformedUrl);
          } 
          // For other file types, keep the original format but ensure it's consistent
          else if (file.url.includes('/a/')) {
            // Keep using /a/ format for images and other files
            transformedUrl = file.url;
            console.log("Keeping original URL format for non-video on t8x8bguwl4:", transformedUrl);
          }
        }
      } else if (file.url.includes('/f/') && process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID) {
        // For other UploadThing domains, follow the standard pattern
        transformedUrl = file.url.replace(
          "/f/",
          `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`
        );
        console.log("Transformed standard URL from /f/ to /a/ format:", transformedUrl);
      }
      
      // For video files, store the URL in a format our proxy can use
      if (isVideo) {
        // For videos, we'll use our proxy URL when it's retrieved
        console.log("Video will be served through proxy during playback");
      }
      
      console.log("Creating media record with:", {
        originalUrl: file.url,
        transformedUrl,
        type: isImage ? "IMAGE" : isVideo ? "VIDEO" : "UNKNOWN",
        originalType: file.type,
        fileName: file.name,
        extension: extension
      });
      
      const media = await prisma.media.create({
        data: {
          url: transformedUrl,
          type: isImage ? "IMAGE" : "VIDEO",
        },
      });

      return { 
        mediaId: media.id,
        url: transformedUrl,
        type: isImage ? "IMAGE" : "VIDEO" 
      };
    }),
} satisfies FileRouter;

export type AppFileRouter = typeof fileRouter;
