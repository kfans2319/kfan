import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/subscriptions - Get active subscriptions for the current user
 */
export async function GET(req: NextRequest) {
  // Validate user is authenticated
  const { user } = await validateRequest();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Parse pagination parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // Fetch active subscriptions for the current user
    const [subscriptions, totalCount] = await Promise.all([
      prisma.subscription.findMany({
        where: {
          subscriberId: user.id,
        },
        include: {
          tier: {
            include: {
              creator: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  bio: true,
                },
              },
            },
          },
        },
        orderBy: {
          expiresAt: "asc", // Sort by expiration date (soonest first)
        },
        skip,
        take: limit,
      }),
      prisma.subscription.count({
        where: {
          subscriberId: user.id,
        },
      }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    return NextResponse.json({
      subscriptions,
      meta: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext,
        hasPrevious,
      },
    });
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
} 