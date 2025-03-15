import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { user } = await validateRequest();
  if (!user) {
    return NextResponse.json({ subscribed: false }, { status: 401 });
  }

  const url = new URL(req.url);
  const creatorId = url.searchParams.get("creatorId");

  if (!creatorId) {
    return NextResponse.json(
      { error: "Creator ID is required" },
      { status: 400 }
    );
  }

  // If the user is the creator, they're always "subscribed" to themselves
  if (user.id === creatorId) {
    return NextResponse.json({ subscribed: true });
  }

  // Check if there's an active subscription
  // First find any subscription tiers this creator has
  const tiers = await prisma.subscriptionTier.findMany({
    where: {
      creatorId: creatorId
    },
    select: {
      id: true
    }
  });

  const tierIds = tiers.map(tier => tier.id);

  // No tiers found, so there can't be a subscription
  if (tierIds.length === 0) {
    return NextResponse.json({ subscribed: false });
  }

  // Now find if the user is subscribed to any of the tiers
  const subscription = await prisma.subscription.findFirst({
    where: {
      subscriberId: user.id,
      tierId: {
        in: tierIds
      },
      expiresAt: {
        gt: new Date()
      }
    }
  });

  return NextResponse.json({ subscribed: !!subscription });
}
