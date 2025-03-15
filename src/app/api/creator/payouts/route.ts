import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/creator/payouts - Get payout request history for the creator
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
    // Parse pagination parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // Fetch payout requests for the creator
    const [payouts, totalCount] = await Promise.all([
      prisma.payoutRequest.findMany({
        where: {
          userId: user.id,
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
        orderBy: {
          requestedAt: "desc", // Most recent first
        },
        skip,
        take: limit,
      }),
      prisma.payoutRequest.count({
        where: {
          userId: user.id,
        },
      }),
    ]);

    // Convert Decimal values to numbers
    const serializedPayouts = payouts.map(payout => ({
      ...payout,
      amount: payout.amount.toNumber()
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    return NextResponse.json({
      payoutRequests: serializedPayouts,
      meta: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext,
        hasPrevious,
      },
    });
  } catch (error) {
    console.error("Error fetching payout history:", error);
    return NextResponse.json(
      { error: "Failed to fetch payout history" },
      { status: 500 }
    );
  }
} 