import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and an admin
    const { user } = await validateRequest();
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify user is an admin
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    });

    if (!userData?.isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // Get request body
    const body = await request.json();
    const { payoutId, status, notes } = body;

    // Validate required fields
    if (!payoutId || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate status value
    if (!["APPROVED", "REJECTED", "COMPLETED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    // If rejecting, require notes
    if (status === "REJECTED" && !notes) {
      return NextResponse.json(
        { error: "Notes are required when rejecting a payout request" },
        { status: 400 }
      );
    }

    // Fetch the current payout request to check its status and amount
    const currentPayout = await prisma.payoutRequest.findUnique({
      where: { id: payoutId },
      select: {
        status: true,
        amount: true,
        userId: true
      }
    });

    if (!currentPayout) {
      return NextResponse.json(
        { error: "Payout request not found" },
        { status: 404 }
      );
    }

    // Use a transaction to ensure both operations complete together
    const result = await prisma.$transaction(async (tx) => {
      // Update the payout request
      const updatedPayout = await tx.payoutRequest.update({
        where: { id: payoutId },
        data: {
          status,
          notes: notes || null,
          processedAt: new Date(),
          processorId: user.id
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              isVerified: true,
              bankInformation: true,
              earningsBalance: true
            }
          },
          processor: {
            select: {
              id: true,
              username: true,
              displayName: true,
            }
          }
        }
      });

      // If rejecting a payout that was previously PENDING, refund the amount
      if (status === "REJECTED" && currentPayout.status === "PENDING") {
        console.log(`Refunding ${currentPayout.amount} to user ${currentPayout.userId}`);
        
        // Update user's earnings balance to add back the rejected amount
        await tx.user.update({
          where: { id: currentPayout.userId },
          data: {
            earningsBalance: {
              increment: currentPayout.amount
            }
          }
        });
      }

      return updatedPayout;
    });

    return NextResponse.json({
      message: `Payout request ${status.toLowerCase()} successfully`,
      payout: result
    });
  } catch (error) {
    console.error("Error updating payout status:", error);
    return NextResponse.json(
      { error: "Failed to update payout status" },
      { status: 500 }
    );
  }
} 