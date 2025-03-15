import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const submissionSchema = z.object({
  selfieImageUrl: z.string().min(1),
  idImageUrl: z.string().min(1),
  userId: z.string().min(1),
  verificationPose: z.string().min(1),
});

export async function POST(request: Request) {
  // Check if the user is authenticated
  const { user } = await validateRequest();
  
  if (!user) {
    console.error("Verification submission failed: User not authenticated");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    // Parse and validate the request body
    const body = await request.json();
    console.log("Verification submission received:", {
      userId: body.userId,
      hasSelfieUrl: !!body.selfieImageUrl,
      hasIdUrl: !!body.idImageUrl,
      hasPose: !!body.verificationPose,
    });
    
    const validation = submissionSchema.safeParse(body);
    
    if (!validation.success) {
      console.error("Verification validation failed:", validation.error.format());
      return Response.json(
        { error: "Invalid submission data", details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { selfieImageUrl, idImageUrl, userId, verificationPose } = validation.data;
    
    // Ensure the authenticated user can only submit verification for themselves
    if (user.id !== userId) {
      console.error("Verification user mismatch:", { 
        requestUserId: userId, 
        authenticatedUserId: user.id 
      });
      return Response.json(
        { error: "You can only submit verification for your own account" },
        { status: 403 }
      );
    }
    
    console.log("Updating user verification status:", userId);
    // Update the user's verification status
    await prisma.user.update({
      where: { id: userId },
      data: {
        selfieImageUrl,
        idImageUrl,
        verificationPose,
        verificationStatus: "PENDING",
        verificationSubmittedAt: new Date(),
      },
    });
    
    console.log("Verification submitted successfully for user:", userId);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error submitting verification:", error);
    return Response.json(
      { error: "Failed to submit verification" },
      { status: 500 }
    );
  }
} 