"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import streamServerClient from "@/lib/stream";
import { getUserDataSelect } from "@/lib/types";
import {
  updateUserProfileSchema,
  UpdateUserProfileValues,
  SubscriptionTierValues,
} from "@/lib/validation";

export async function updateUserProfile(values: UpdateUserProfileValues) {
  const validatedValues = updateUserProfileSchema.parse(values);

  const { user } = await validateRequest();

  if (!user) throw new Error("Unauthorized");

  const updatedUser = await prisma.$transaction(async (tx) => {
    // Delete existing tiers that are not in the new list
    await tx.subscriptionTier.deleteMany({
      where: {
        creatorId: user.id,
        id: {
          notIn: validatedValues.subscriptionTiers
            .map((tier) => tier.id)
            .filter((id): id is string => id !== undefined),
        },
      },
    });

    // Create new tiers
    const newTiers = validatedValues.subscriptionTiers.filter((tier): tier is SubscriptionTierValues => !tier.id);
    await tx.subscriptionTier.createMany({
      data: newTiers.map((tier) => ({
        name: tier.name,
        description: tier.description,
        price: tier.price,
        ...(tier.duration !== undefined ? { duration: tier.duration } as any : {}),
        creatorId: user.id,
      })),
    });

    // Update existing tiers
    await Promise.all(
      validatedValues.subscriptionTiers
        .filter((tier): tier is SubscriptionTierValues & { id: string } => !!tier.id)
        .map((tier) =>
          tx.subscriptionTier.update({
            where: { id: tier.id },
            data: {
              name: tier.name,
              description: tier.description,
              price: tier.price,
              ...(tier.duration !== undefined ? { duration: tier.duration } as any : {})
            },
          }),
        ),
    );

    // Update user profile - using raw query to add bannerImageUrl support
    // without requiring schema changes to be fully applied
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        displayName: validatedValues.displayName,
        bio: validatedValues.bio,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        createdTiers: true,
        followers: {
          where: { followerId: user.id },
          select: { followerId: true }
        },
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true
          }
        }
      }
    });

    // Using as any to handle the TypeScript limitations with the bannerImageUrl field
    return {
      ...updatedUser,
      bannerImageUrl: await tx.user.findUnique({
        where: { id: user.id },
        // @ts-ignore - field exists in DB but not yet in TypeScript
        select: { bannerImageUrl: true }
      }).then(user => user?.bannerImageUrl || null)
    };
  }, { timeout: 10000 }); // Increase transaction timeout to 10 seconds

  return updatedUser;
}

export async function handleExpiredSubscriptions() {
  const expiredSubscriptions = await prisma.subscription.findMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
    },
    include: {
      subscriber: true,
      tier: true,
    },
  });

  await Promise.all(
    expiredSubscriptions.map(async (subscription) => {
      // If auto-renew is enabled and subscriber has enough balance, renew the subscription
      if (subscription.autoRenew) {
        const amount = Number(subscription.tier.price);
        // Check if subscriber has enough balance
        if (Number(subscription.subscriber.balance) >= amount) {
          await prisma.$transaction([
            // Deduct from subscriber's balance
            prisma.user.update({
              where: { id: subscription.subscriberId },
              data: {
                balance: {
                  decrement: amount,
                },
              },
            }),
            // Add to creator's balance
            prisma.user.update({
              where: { id: subscription.tier.creatorId },
              data: {
                balance: {
                  increment: amount,
                },
              },
            }),
            // Update subscription expiry
            prisma.subscription.update({
              where: { id: subscription.id },
              data: {
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
              },
            }),
          ]);
        } else {
          // Not enough balance, disable auto-renew
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              autoRenew: false,
            },
          });
        }
      } else {
        // Delete expired subscription if auto-renew is disabled
        await prisma.subscription.delete({
          where: { id: subscription.id },
        });
      }
    })
  );
}
