import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/subscriptions/cancel - Cancel a subscription
 */
export async function POST(req: NextRequest) {
  // Validate user is authenticated
  const { user } = await validateRequest();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get subscription ID from request body
    const { subscriptionId } = await req.json();
    
    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Subscription ID is required" },
        { status: 400 }
      );
    }

    // Find the subscription and ensure it belongs to the current user
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    if (subscription.subscriberId !== user.id) {
      return NextResponse.json(
        { error: "You do not have permission to cancel this subscription" },
        { status: 403 }
      );
    }

    // Update the subscription - we'll disable auto-renew rather than deleting
    // This way the subscription remains valid until it expires
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        autoRenew: false,
      },
    });

    return NextResponse.json({
      message: "Subscription auto-renewal has been disabled",
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    );
  }
} 