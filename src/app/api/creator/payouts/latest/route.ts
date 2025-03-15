import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/creator/payouts/latest - Get the most recent payout request
 */
export async function GET(req: NextRequest) {
  // Validate user is authenticated and verified
  const { user } = await validateRequest();
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is verified
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isVerified: true, verificationStatus: true },
  });

  if (!userData?.isVerified || userData.verificationStatus !== "APPROVED") {
    return NextResponse.json({ error: "User is not verified" }, { status: 403 });
  }

  try {
    // Fetch latest payout request for the creator
    const latestPayout = await prisma.payoutRequest.findFirst({
      where: {
        userId: user.id,
      },
      orderBy: {
        requestedAt: "desc", // Most recent first
      },
    });

    if (!latestPayout) {
      return NextResponse.json({ error: "No payout requests found" }, { status: 404 });
    }

    return NextResponse.json(latestPayout);
  } catch (error) {
    console.error("Error fetching latest payout:", error);
    return NextResponse.json(
      { error: "Failed to fetch latest payout" },
      { status: 500 }
    );
  }
} 