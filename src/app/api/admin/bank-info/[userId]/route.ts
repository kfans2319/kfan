import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  // Validate user is authenticated and is an admin
  const { user } = await validateRequest();
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if the user is an admin
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });

  if (!userData?.isAdmin) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  const userId = params.userId;
  
  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    // Fetch the bank information for the specified user
    const bankInfo = await prisma.bankInformation.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
          },
        },
      },
    });

    if (!bankInfo) {
      return NextResponse.json({ error: "Bank information not found" }, { status: 404 });
    }

    // Return the full bank information
    return NextResponse.json({
      id: bankInfo.id,
      userId: bankInfo.userId,
      username: bankInfo.user.username,
      displayName: bankInfo.user.displayName,
      avatarUrl: bankInfo.user.avatarUrl,
      isVerified: bankInfo.user.isVerified,
      bankName: bankInfo.bankName,
      accountHolderName: bankInfo.accountHolderName,
      accountNumber: bankInfo.accountNumber, // Full account number
      routingNumber: bankInfo.routingNumber, // Full routing number
      createdAt: bankInfo.createdAt,
      updatedAt: bankInfo.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching bank information:", error);
    return NextResponse.json(
      { error: "Failed to fetch bank information" },
      { status: 500 }
    );
  }
} 