import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/creator/payouts/[id] - Get a specific payout request by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Get the payout ID from the URL
  const payoutId = params.id;
  
  // Validate user is authenticated
  const { user } = await validateRequest();
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find the payout request and make sure it belongs to this user
    const payoutRequest = await prisma.payoutRequest.findUnique({
      where: {
        id: payoutId,
        userId: user.id, // Security check to ensure user can only access their own payouts
      },
      include: {
        processor: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    // If not found or doesn't belong to user
    if (!payoutRequest) {
      return NextResponse.json(
        { error: "Payout request not found" },
        { status: 404 }
      );
    }

    // Convert Decimal values to numbers
    const serializedPayout = {
      ...payoutRequest,
      amount: payoutRequest.amount.toNumber()
    };

    return NextResponse.json(serializedPayout);
  } catch (error) {
    console.error("Error fetching payout details:", error);
    return NextResponse.json(
      { error: "Failed to fetch payout details" },
      { status: 500 }
    );
  }
} 