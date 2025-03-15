import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// Platform fee percentage
const PLATFORM_FEE_PERCENTAGE = 15;

export async function POST(request: Request) {
  try {
    // Validate the user is authenticated
    const { user } = await validateRequest();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get request body
    const { tierId, autoRenew = true } = await request.json();
    
    if (!tierId) {
      return NextResponse.json({ error: "Tier ID is required" }, { status: 400 });
    }

    // Get subscription tier
    const tier = await prisma.subscriptionTier.findUnique({
      where: { id: tierId },
      include: { creator: { select: { id: true } } }
    });

    if (!tier) {
      return NextResponse.json({ error: "Subscription tier not found" }, { status: 404 });
    }

    // Cannot subscribe to your own tier
    if (tier.creatorId === user.id) {
      return NextResponse.json({ error: "You cannot subscribe to your own tier" }, { status: 400 });
    }

    // Check if user already has an active subscription to this tier
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        subscriberId: user.id,
        tierId: tier.id,
        expiresAt: { gt: new Date() }
      }
    });

    if (existingSubscription) {
      return NextResponse.json({ error: "You already have an active subscription to this tier" }, { status: 400 });
    }

    // Check if user has enough balance
    const userWithBalance = await prisma.user.findUnique({
      where: { id: user.id },
      select: { balance: true }
    });

    const balance = Number(userWithBalance?.balance || 0);
    const price = Number(tier.price);

    if (balance < price) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    // Calculate expiration date based on tier duration
    // The tier type might not have duration in TypeScript, but the database has it
    // Cast to any to access the duration property that we know exists in the database
    const tierWithDuration = tier as any;
    const duration = tierWithDuration.duration || 1; // Default to 1 month if not specified
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + duration);

    // Calculate platform fee and creator earnings
    const platformFee = (price * PLATFORM_FEE_PERCENTAGE) / 100;
    const creatorEarnings = price - platformFee;

    // Create subscription in a transaction
    const result = await prisma.$transaction([
      // Deduct from subscriber's balance
      prisma.user.update({
        where: { id: user.id },
        data: {
          balance: {
            decrement: price
          }
        }
      }),
      // Add to creator's earnings balance (after deducting platform fee)
      prisma.user.update({
        where: { id: tier.creatorId },
        data: {
          earningsBalance: {
            increment: creatorEarnings
          }
        }
      }),
      // Create the subscription
      prisma.subscription.create({
        data: {
          subscriberId: user.id,
          tierId: tier.id,
          expiresAt,
          autoRenew
        }
      })
    ]);

    // Get the newly created subscription
    const subscription = result[2];

    // Create a creator earning record to track this payment
    await prisma.creatorEarning.create({
      data: {
        creatorId: tier.creatorId,
        subscriberId: user.id,
        subscriptionId: subscription.id,
        amount: creatorEarnings,
        platformFee: platformFee,
      }
    });

    return NextResponse.json({
      message: "Subscription created successfully",
      subscription
    });
  } catch (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json(
      { error: "An error occurred while creating the subscription" },
      { status: 500 }
    );
  }
} 