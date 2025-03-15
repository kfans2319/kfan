import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/payouts - Get all payout requests with filters and pagination
 * Admin only endpoint
 */
export async function GET(req: NextRequest) {
  try {
    // Validate user is authenticated and is an admin
    const { user } = await validateRequest();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is an admin
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    });

    if (!userData?.isAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const status = url.searchParams.get("status") || undefined;
    const sortBy = url.searchParams.get("sortBy") || "requestedAt";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";
    const skip = (page - 1) * limit;

    // Build query filters
    const filters: any = {};
    if (status) {
      filters.status = status;
    }

    // Count total matching records
    const totalCount = await prisma.payoutRequest.count({
      where: filters,
    });

    // Fetch payout requests with pagination
    const payouts = await prisma.payoutRequest.findMany({
      where: filters,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
            bankInformation: true,
          }
        },
        processor: {
          select: {
            id: true,
            username: true,
            displayName: true,
          }
        }
      },
      orderBy: {
        [sortBy]: sortOrder.toLowerCase(),
      },
      skip,
      take: limit,
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return NextResponse.json({
      payouts,
      meta: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage,
        hasPreviousPage,
      }
    });
  } catch (error) {
    console.error("Error fetching payout requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch payout requests" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/payouts - Update payout request status
 * Admin only endpoint
 */
export async function PATCH(req: NextRequest) {
  try {
    // Validate user is authenticated and is an admin
    const { user } = await validateRequest();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is an admin
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    });

    if (!userData?.isAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Parse request body
    const { payoutId, status, notes } = await req.json();
    
    if (!payoutId || !status) {
      return NextResponse.json(
        { error: "Missing required fields: payoutId and status" },
        { status: 400 }
      );
    }

    // Validate status value
    const validStatuses = ["APPROVED", "REJECTED", "PENDING", "COMPLETED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Get the payout request
    const payoutRequest = await prisma.payoutRequest.findUnique({
      where: { id: payoutId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            earningsBalance: true,
          },
        },
      },
    });

    if (!payoutRequest) {
      return NextResponse.json(
        { error: "Payout request not found" },
        { status: 404 }
      );
    }

    // Update the payout request
    const updatedPayout = await prisma.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status,
        notes: notes || undefined,
        processedAt: new Date(),
        processorId: user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    // If the request was rejected, we need to add the amount back to the user's earnings balance
    if (status === "REJECTED" && payoutRequest.status === "PENDING") {
      await prisma.user.update({
        where: { id: payoutRequest.userId },
        data: {
          earningsBalance: {
            increment: payoutRequest.amount,
          },
        },
      });
    }

    // Convert Decimal values to numbers for the response
    return NextResponse.json({
      payout: {
        ...updatedPayout,
        amount: updatedPayout.amount.toNumber(),
      },
      message: `Payout request ${status.toLowerCase()} successfully`,
    });
  } catch (error) {
    console.error("Error updating payout request:", error);
    return NextResponse.json(
      { error: "Failed to update payout request" },
      { status: 500 }
    );
  }
} 