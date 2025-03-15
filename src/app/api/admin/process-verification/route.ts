import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const processSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED"]),
});

export async function POST(request: Request) {
  // Check if the user is authenticated and is an admin
  const { user } = await validateRequest();
  
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Verify the user is an admin
  const adminUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });
  
  if (!adminUser?.isAdmin) {
    return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }
  
  try {
    // Parse and validate the request body
    const body = await request.json();
    const validation = processSchema.safeParse(body);
    
    if (!validation.success) {
      return Response.json(
        { error: "Invalid request data", details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { userId, status } = validation.data;
    
    // Update the user's verification status
    await prisma.user.update({
      where: { id: userId },
      data: {
        verificationStatus: status,
        isVerified: status === "APPROVED",
        verificationProcessedAt: new Date(),
        verificationProcessedById: user.id,
      },
    });
    
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error processing verification:", error);
    return Response.json(
      { error: "Failed to process verification" },
      { status: 500 }
    );
  }
} 