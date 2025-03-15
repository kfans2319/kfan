import { validateRequest } from "@/auth";
import FollowButton from "@/components/FollowButton";
import FollowerCount from "@/components/FollowerCount";
import Linkify from "@/components/Linkify";
import TrendsSidebar from "@/components/TrendsSidebar";
import UserAvatar from "@/components/UserAvatar";
import prisma from "@/lib/prisma";
import { FollowerInfo, getUserDataSelect, UserData } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { formatDate } from "date-fns";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import EditProfileButton from "./EditProfileButton";
import UserPosts from "./UserPosts";
import SubscriptionTierButtons from "./SubscriptionTierButtons";
import Image from "next/image";

interface PageProps {
  params: { username: string };
}

const getUser = cache(async (username: string, loggedInUserId: string) => {
  const user = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
    select: getUserDataSelect(loggedInUserId),
  });

  if (!user) notFound();

  return user;
});

export async function generateMetadata({
  params: { username },
}: PageProps): Promise<Metadata> {
  const { user: loggedInUser } = await validateRequest();

  // Use a dummy ID for unauthenticated users
  const loggedInUserId = loggedInUser?.id || 'unauthenticated';
  
  const user = await getUser(username, loggedInUserId);

  return {
    title: `${user.displayName} (@${user.username})`,
  };
}

export default async function Page({ params: { username } }: PageProps) {
  const { user: loggedInUser } = await validateRequest();

  // If no logged-in user, use a dummy ID for the getUser function
  const loggedInUserId = loggedInUser?.id || 'unauthenticated';
  
  const user = await getUser(username, loggedInUserId);

  return (
    <main className="flex w-full min-w-0 gap-5">
      <div className="w-full min-w-0 space-y-5">
        <UserProfile user={user} loggedInUserId={loggedInUserId} />
        <div className="rounded-2xl bg-card p-5 shadow-sm">
          <h2 className="text-center text-2xl font-bold">
            {user.displayName}&apos;s posts
          </h2>
        </div>
        <UserPosts userId={user.id} />
      </div>
      <TrendsSidebar />
    </main>
  );
}

interface UserProfileProps {
  user: UserData;
  loggedInUserId: string;
}

async function UserProfile({ user, loggedInUserId }: UserProfileProps) {
  const followerInfo: FollowerInfo = {
    followers: user._count.followers,
    isFollowedByUser: user.followers.some(
      ({ followerId }) => followerId === loggedInUserId && loggedInUserId !== 'unauthenticated',
    ),
  };

  // Get the bannerImageUrl with TypeScript safety
  const bannerImageUrl = (user as any).bannerImageUrl;

  return (
    <div className="h-fit w-full rounded-2xl bg-card shadow-sm">
      <div className="relative">
        {/* Banner Image */}
        <div className="h-48 w-full overflow-hidden rounded-t-2xl">
          {bannerImageUrl ? (
            <Image 
              src={bannerImageUrl} 
              alt="Profile banner"
              width={1200}
              height={400}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-blue-400 to-indigo-500" />
          )}
        </div>
        
        {/* Avatar positioned on top of the banner */}
        <div className="absolute -bottom-16 left-8">
          <UserAvatar
            avatarUrl={user.avatarUrl}
            size={120}
            className="border-4 border-card shadow-md"
          />
        </div>
        
        {/* Conditional button - either Edit Profile or Follow button */}
        <div className="absolute right-5 top-5 z-10">
          {loggedInUserId !== 'unauthenticated' && (
            user.id === loggedInUserId ? (
              <EditProfileButton user={user} />
            ) : (
              <div className="bg-background/95 backdrop-blur-sm rounded-md shadow-md">
                <FollowButton userId={user.id} initialState={followerInfo} />
              </div>
            )
          )}
        </div>
      </div>
      
      {/* Profile content with padding to account for the overlapping avatar */}
      <div className="space-y-3 p-5 pt-20">
        <div>
          <h1 className="text-3xl font-bold">{user.displayName}</h1>
          <div className="text-muted-foreground">@{user.username}</div>
        </div>
        
        <div>Member since {formatDate(user.createdAt, "MMM d, yyyy")}</div>
        <div className="flex items-center gap-3">
          <span>
            Posts:{" "}
            <span className="font-semibold">
              {formatNumber(user._count.posts)}
            </span>
          </span>
          <FollowerCount userId={user.id} initialState={followerInfo} />
        </div>
        
        {user.createdTiers?.length > 0 && (
          <div className="mt-2">
            <SubscriptionTierButtons
              tiers={user.createdTiers.map(tier => {
                const transformedTier = {
                  ...tier,
                  price: Number(tier.price),
                  duration: (tier as any).duration || 1,
                  creatorId: tier.creatorId
                };
                return transformedTier;
              })}
            />
          </div>
        )}
      </div>
      
      {user.bio && (
        <div className="border-t p-5">
          <Linkify>
            <div className="overflow-hidden whitespace-pre-line break-words">
              {user.bio}
            </div>
          </Linkify>
        </div>
      )}
    </div>
  );
}
