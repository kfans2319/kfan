import avatarPlaceholder from "@/assets/avatar-placeholder.png";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface UserAvatarProps {
  avatarUrl: string | null | undefined;
  size?: number;
  className?: string;
}

export default function UserAvatar({
  avatarUrl,
  size,
  className,
}: UserAvatarProps) {
  // Transform the UploadThing URL to use the working format
  let optimizedAvatarUrl = avatarUrl;
  if (avatarUrl && (avatarUrl.includes('t8x8bguwl4.ufs.sh') || avatarUrl.includes('utfs.io'))) {
    // Extract the file ID from the URL path
    const fileId = avatarUrl.split('/').pop();
    
    // For t8x8bguwl4.ufs.sh domain, prefer the /f/ format
    if (avatarUrl.includes('t8x8bguwl4.ufs.sh') && fileId) {
      optimizedAvatarUrl = `https://t8x8bguwl4.ufs.sh/f/${fileId}`;
      console.log("Using optimized avatar URL format:", optimizedAvatarUrl);
    }
  }

  return (
    <Image
      src={optimizedAvatarUrl || avatarPlaceholder}
      alt="User avatar"
      width={size ?? 48}
      height={size ?? 48}
      className={cn(
        "aspect-square h-fit flex-none rounded-full bg-secondary object-cover",
        className,
      )}
    />
  );
}
