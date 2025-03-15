import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ethers } from "ethers";
import { PayoutRequestStatus } from "@prisma/client";

// Validation schema for payout request
const payoutRequestSchema = z.object({
  amount: z.coerce
    .number()
    .min(100, "Minimum payout amount is $100")
    .refine((val) => val <= 10000, "Maximum payout amount is $10,000"),
  payoutMethod: z.enum(["BANK", "ETH_WALLET"]),
  ethWalletAddress: z.string().optional()
    .refine(
      (val) => !val || ethers.isAddress(val),
      { message: "Invalid Ethereum wallet address" }
    ),
});

/**
 * POST /api/creator/payouts/request - Submit a payout request
 */
export async function POST(req: NextRequest) {
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
    // Parse and validate request body
    const body = await req.json();
    console.log("Request body:", body);
    
    const validation = payoutRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid payout request", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { amount, payoutMethod, ethWalletAddress } = validation.data;
    const userEarningsBalance = userData.earningsBalance.toNumber();

    // Check if user has enough earnings balance
    if (userEarningsBalance < amount) {
      return NextResponse.json(
        { error: `Insufficient earnings balance. Available: $${userEarningsBalance.toFixed(2)}` },
        { status: 400 }
      );
    }

    // Check payment method requirements
    if (payoutMethod === "BANK") {
      // Check if user has bank information for bank payouts
      const bankInfo = await prisma.bankInformation.findUnique({
        where: { userId: user.id },
      });

      if (!bankInfo) {
        return NextResponse.json(
          { error: "You must add bank information before requesting a bank payout" },
          { status: 400 }
        );
      }

      // Use type assertion to handle the bankType property that TypeScript doesn't recognize
      const bankTypeValue = (bankInfo as any).bankType || "DOMESTIC";
      
      // Log the bank type for debugging
      console.log(`User bank type: ${bankTypeValue}`);
      
      // For international banks, add a note about processing time
      const processingNote = bankTypeValue === "INTERNATIONAL" 
        ? "Note: International transfers may take 5-7 business days to process"
        : "Domestic bank transfers typically process within 3-5 business days";
      
      console.log(processingNote);
    } else if (payoutMethod === "ETH_WALLET") {
      // Require ETH wallet address for ETH wallet payouts
      if (!ethWalletAddress) {
        return NextResponse.json(
          { error: "Ethereum wallet address is required for ETH wallet payouts" },
          { status: 400 }
        );
      }
    }

    // Check if there's an existing pending payout request
    const pendingRequest = await prisma.payoutRequest.findFirst({
      where: {
        userId: user.id,
        status: "PENDING",
      },
    });

    if (pendingRequest) {
      return NextResponse.json(
        { error: "You already have a pending payout request" },
        { status: 400 }
      );
    }

    try {
      // Create the payout request and update the balance in a transaction
      const payoutRequest = await prisma.$transaction(async (tx) => {
        // Create the payout request with the correct fields for the selected payment method
        const newRequest = await tx.payoutRequest.create({
          data: {
            userId: user.id,
            amount,
            status: "PENDING" as PayoutRequestStatus,
            payoutMethod,
            ethWalletAddress: payoutMethod === "ETH_WALLET" ? ethWalletAddress : null,
          },
        });
        
        // Update user earnings balance
        await tx.user.update({
          where: { id: user.id },
          data: {
            earningsBalance: {
              decrement: amount,
            },
          },
        });
        
        return newRequest;
      });
      
      console.log("Payout request created successfully:", {
        id: payoutRequest.id,
        amount: payoutRequest.amount.toString(),
        status: payoutRequest.status,
        method: payoutRequest.payoutMethod,
        walletAddress: payoutRequest.ethWalletAddress,
      });
      
      return NextResponse.json({
        success: true,
        message: "Payout request submitted successfully",
        payoutRequest: {
          id: payoutRequest.id,
          amount: payoutRequest.amount.toNumber(),
          status: payoutRequest.status,
          method: payoutRequest.payoutMethod,
          walletAddress: payoutRequest.ethWalletAddress,
          requestedAt: payoutRequest.requestedAt,
        },
      });
    } catch (dbError) {
      console.error("Database error creating payout request:", dbError);
      return NextResponse.json(
        { error: "Database error creating payout request. Please try again." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error creating payout request:", error);
    
    // More descriptive error message
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Detailed error:", errorMessage);
    
    return NextResponse.json(
      { error: "Failed to create payout request. Please try again later." },
      { status: 500 }
    );
  }
} 