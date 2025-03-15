import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Platform fee percentage
const PLATFORM_FEE_PERCENTAGE = 15;

/**
 * GET /api/creator/earnings/stats - Get earnings statistics for the creator
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
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get total earnings and platform fees
    const totalEarningsResult = await prisma.creatorEarning.aggregate({
      where: {
        creatorId: user.id,
      },
      _sum: {
        amount: true,
        platformFee: true,
      },
    });
    
    // Get earnings from the last 30 days
    const last30DaysEarningsResult = await prisma.creatorEarning.aggregate({
      where: {
        creatorId: user.id,
        earnedAt: {
          gte: thirtyDaysAgo,
        },
      },
      _sum: {
        amount: true,
        platformFee: true,
      },
    });
    
    // Get unique subscribers count
    const subscriberCount = await prisma.creatorEarning.groupBy({
      by: ['subscriberId'],
      where: {
        creatorId: user.id,
      },
      _count: true,
    });
    
    // Calculate statistics
    const totalEarnings = totalEarningsResult._sum.amount?.toNumber() || 0;
    const totalPlatformFees = totalEarningsResult._sum.platformFee?.toNumber() || 0;
    const grossEarnings = totalEarnings + totalPlatformFees;
    
    const last30DaysEarnings = last30DaysEarningsResult._sum.amount?.toNumber() || 0;
    const last30DaysFees = last30DaysEarningsResult._sum.platformFee?.toNumber() || 0;
    const last30DaysGross = last30DaysEarnings + last30DaysFees;
    
    const uniqueSubscriberCount = subscriberCount.length;
    const avgEarningPerSubscriber = uniqueSubscriberCount > 0 
      ? totalEarnings / uniqueSubscriberCount 
      : 0;
    
    // Get current balance
    const currentBalance = userData.earningsBalance.toNumber();
    
    return NextResponse.json({
      totalEarnings,
      grossEarnings,
      totalPlatformFees,
      platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
      last30DaysEarnings,
      last30DaysGross,
      last30DaysFees,
      currentBalance,
      subscriberCount: uniqueSubscriberCount,
      avgEarningPerSubscriber,
    });
  } catch (error) {
    console.error("Error fetching earnings statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch earnings statistics" },
      { status: 500 }
    );
  }
} 