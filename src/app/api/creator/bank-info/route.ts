import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Common bank info fields
const commonBankInfoFields = {
  bankType: z.enum(["DOMESTIC", "INTERNATIONAL"]).default("DOMESTIC"),
  bankName: z.string().min(1, "Bank name is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  accountHolderName: z.string().min(1, "Account holder name is required"),
};

// Domestic bank fields
const domesticBankFields = {
  routingNumber: z.string()
    .min(9, "Routing number must be at least 9 digits")
    .max(9, "Routing number must be exactly 9 digits")
    .regex(/^\d+$/, "Routing number should contain only digits"),
};

// International bank fields
const internationalBankFields = {
  swiftCode: z.string().min(8, "SWIFT/BIC code is required").max(11, "SWIFT/BIC code must be 8-11 characters"),
  iban: z.string().optional(),
  bankAddress: z.string().min(1, "Bank address is required"),
  accountHolderAddress: z.string().min(1, "Account holder address is required"),
  intermediaryBankName: z.string().optional(),
  intermediaryBankSwiftCode: z.string().optional(),
  routingNumber: z.string().optional(),
};

// Validation schema creator based on bank type
const createBankInfoSchema = (bankType: "DOMESTIC" | "INTERNATIONAL") => {
  return z.object({
    ...commonBankInfoFields,
    ...(bankType === "DOMESTIC" ? domesticBankFields : {}),
    ...(bankType === "INTERNATIONAL" ? internationalBankFields : {}),
  });
};

/**
 * GET /api/creator/bank-info - Get the bank information for the current user
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
    // Get bank information for the user
    const bankInfo = await prisma.bankInformation.findUnique({
      where: { userId: user.id },
    });

    if (!bankInfo) {
      return NextResponse.json({ error: "Bank information not found" }, { status: 404 });
    }

    return NextResponse.json(bankInfo);
  } catch (error) {
    console.error("Error fetching bank information:", error);
    return NextResponse.json(
      { error: "Failed to fetch bank information" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/creator/bank-info - Create bank information for the current user
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
    select: { isVerified: true, verificationStatus: true },
  });

  if (!userData?.isVerified || userData.verificationStatus !== "APPROVED") {
    return NextResponse.json({ error: "User is not verified" }, { status: 403 });
  }

  try {
    // Check if bank information already exists
    const existingBankInfo = await prisma.bankInformation.findUnique({
      where: { userId: user.id },
    });

    if (existingBankInfo) {
      return NextResponse.json(
        { error: "Bank information already exists for this user" },
        { status: 409 }
      );
    }

    // Parse request body
    const body = await req.json();
    const bankType = body.bankType || "DOMESTIC";
    
    // Select appropriate validation schema based on bank type
    const bankInfoSchema = createBankInfoSchema(bankType);
    const validation = bankInfoSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid bank information", details: validation.error.format() },
        { status: 400 }
      );
    }

    // Create bank information with the appropriate fields
    const bankInfoData: any = {
      userId: user.id,
      bankType: validation.data.bankType,
      bankName: validation.data.bankName,
      accountNumber: validation.data.accountNumber,
      accountHolderName: validation.data.accountHolderName,
      routingNumber: validation.data.routingNumber,
    };

    // Add international fields if applicable
    if (bankType === "INTERNATIONAL") {
      Object.assign(bankInfoData, {
        swiftCode: validation.data.swiftCode,
        iban: validation.data.iban,
        bankAddress: validation.data.bankAddress,
        accountHolderAddress: validation.data.accountHolderAddress,
        intermediaryBankName: validation.data.intermediaryBankName,
        intermediaryBankSwiftCode: validation.data.intermediaryBankSwiftCode,
      });
    }

    // Create bank information
    const bankInfo = await prisma.bankInformation.create({
      data: bankInfoData,
    });

    return NextResponse.json({
      message: "Bank information created successfully",
      bankInfo,
    });
  } catch (error) {
    console.error("Error creating bank information:", error);
    return NextResponse.json(
      { error: "Failed to create bank information" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/creator/bank-info - Update bank information for the current user
 */
export async function PUT(req: NextRequest) {
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
    // Check if bank information exists
    const existingBankInfo = await prisma.bankInformation.findUnique({
      where: { userId: user.id },
    });

    if (!existingBankInfo) {
      return NextResponse.json(
        { error: "Bank information not found for this user" },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await req.json();
    const bankType = body.bankType || "DOMESTIC";
    
    // Select appropriate validation schema based on bank type
    const bankInfoSchema = createBankInfoSchema(bankType);
    const validation = bankInfoSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid bank information", details: validation.error.format() },
        { status: 400 }
      );
    }

    // Prepare update data
    const bankInfoData: any = {
      bankType: validation.data.bankType,
      bankName: validation.data.bankName,
      accountNumber: validation.data.accountNumber,
      accountHolderName: validation.data.accountHolderName,
      routingNumber: validation.data.routingNumber,
    };

    // Add international fields if applicable
    if (bankType === "INTERNATIONAL") {
      Object.assign(bankInfoData, {
        swiftCode: validation.data.swiftCode,
        iban: validation.data.iban,
        bankAddress: validation.data.bankAddress,
        accountHolderAddress: validation.data.accountHolderAddress,
        intermediaryBankName: validation.data.intermediaryBankName,
        intermediaryBankSwiftCode: validation.data.intermediaryBankSwiftCode,
      });
    }

    // Update bank information
    const bankInfo = await prisma.bankInformation.update({
      where: { userId: user.id },
      data: bankInfoData,
    });

    return NextResponse.json({
      message: "Bank information updated successfully",
      bankInfo,
    });
  } catch (error) {
    console.error("Error updating bank information:", error);
    return NextResponse.json(
      { error: "Failed to update bank information" },
      { status: 500 }
    );
  }
} 