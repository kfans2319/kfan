import { prisma } from "./prisma";

/**
 * Check if a user is subscribed to a creator
 * @param userId The ID of the user (subscriber)
 * @param creatorId The ID of the creator
 * @returns boolean indicating if the user is subscribed
 */
export async function isSubscribedToCreator(userId: string, creatorId: string): Promise<boolean> {
  // If the user is the creator, they're always "subscribed" to themselves
  if (userId === creatorId) {
    return true;
  }

  // Check if there's an active subscription
  const subscription = await prisma.subscription.findFirst({
    where: {
      subscriberId: userId,
      tier: {
        creatorId: creatorId
      },
      expiresAt: {
        gt: new Date()
      }
    }
  });

  return !!subscription;
}
