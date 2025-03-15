import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/library";

// Platform fee percentage
const PLATFORM_FEE_PERCENTAGE = 15;

// Define a type for objects with potential Decimal values
interface WithDecimal {
  [key: string]: any;
  toNumber?: () => number;
}

/**
 * GET /api/creator/earnings - Get earnings history for the creator
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
    select: { 
      isVerified: true, 
      verificationStatus: true,
      earningsBalance: true 
    },
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

    // Fetch earnings for the creator
    const [earnings, totalCount] = await Promise.all([
      prisma.creatorEarning.findMany({
        where: {
          creatorId: user.id,
        },
        select: {
          id: true,
          amount: true,
          platformFee: true,
          earnedAt: true,
          subscriber: {
            select: {
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          subscription: {
            select: {
              tier: {
                select: {
                  name: true,
                  price: true,
                },
              },
            },
          },
        },
        orderBy: {
          earnedAt: "desc", // Most recent first
        },
        skip,
        take: limit,
      }),
      prisma.creatorEarning.count({
        where: {
          creatorId: user.id,
        },
      }),
    ]);

    // Convert Decimal values to numbers to avoid serialization issues
    const serializedEarnings = earnings.map((earning: any) => {
      // Create a deep copy that we can modify
      const serialized = JSON.parse(JSON.stringify(earning, (key, value) => {
        // Convert any Decimal objects to numbers
        if (value !== null && 
            typeof value === 'object' && 
            typeof (value as WithDecimal).toNumber === 'function') {
          return (value as WithDecimal).toNumber();
        }
        return value;
      }));
      
      // Calculate gross amount before platform fee
      const netAmount = serialized.amount || 0;
      const platformFee = serialized.platformFee || 0;
      serialized.grossAmount = netAmount + platformFee;
      serialized.platformFeePercentage = PLATFORM_FEE_PERCENTAGE;
      
      return serialized;
    });

    // Calculate current earnings balance
    const earningsBalance = userData.earningsBalance.toNumber();

    return NextResponse.json({
      earnings: serializedEarnings,
      earningsBalance,
      platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
      meta: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrevious: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching earnings:", error);
    return NextResponse.json(
      { error: "Failed to fetch earnings" },
      { status: 500 }
    );
  }
} 