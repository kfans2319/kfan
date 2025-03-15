"use client";

import { MediaType } from "@prisma/client";
import { Lock, ImageIcon, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "./ui/button";
import { motion } from "framer-motion";

interface PremiumContentProps {
  mediaType: MediaType;
  creatorUsername: string;
  className?: string;
}

/**
 * Component that shows a visually appealing placeholder for premium content
 * with sophisticated gradient backgrounds and elegant messaging
 */
export default function PremiumContent({
  mediaType,
  creatorUsername,
  className,
}: PremiumContentProps) {
  const isImage = mediaType === "IMAGE";
  
  return (
    <div
      className={cn(
        "relative mx-auto flex size-full max-h-[30rem] flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/30 shadow-sm",
        isImage
          ? "bg-gradient-to-br from-indigo-50/90 via-blue-50/80 to-violet-50/90 dark:from-indigo-950/90 dark:via-blue-950/80 dark:to-violet-950/90"
          : "bg-gradient-to-br from-amber-50/90 via-rose-50/80 to-pink-50/90 dark:from-amber-950/90 dark:via-rose-950/80 dark:to-pink-950/90",
        className
      )}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      
      {/* Blur circles for decorative effect */}
      <div className="absolute left-1/4 top-1/4 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-24 w-24 rounded-full bg-secondary/20 blur-3xl" />
      
      {/* Content placeholder */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative flex flex-col items-center justify-center gap-4 px-8 py-12 text-center"
      >
        <div className="relative mb-2 rounded-full bg-background/10 p-5 backdrop-blur-md">
          {isImage ? (
            <ImageIcon className="size-10 text-foreground/90" />
          ) : (
            <PlayCircle className="size-10 text-foreground/90" />
          )}
          <motion.div 
            animate={{ 
              scale: [1, 1.05, 1],
              opacity: [0.8, 1, 0.8]
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 2
            }}
            className="absolute -inset-1 rounded-full border border-primary/20 bg-primary/5"
          />
        </div>
        
        <h3 className="text-2xl font-semibold tracking-tight text-foreground backdrop-blur-sm">
          Premium {isImage ? "Image" : "Video"}
        </h3>
        
        <p className="max-w-md text-foreground/70 backdrop-blur-sm">
          You can read the post content, but subscribe to <span className="font-medium text-primary">@{creatorUsername}</span> to view 
          {isImage ? " high-quality images" : " exclusive videos"}.
        </p>
        
        <Link href={`/users/${creatorUsername}`} className="mt-4">
          <Button 
            className="rounded-full px-6 py-2 font-medium shadow-sm transition-all hover:shadow-md" 
            variant="secondary"
          >
            <Lock className="mr-2 size-4" /> Subscribe
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
