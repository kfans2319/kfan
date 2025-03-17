import { validateRequest } from "@/auth";
import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    // Authenticate user
    const { user } = await validateRequest();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse amount from request
    const body = await request.json();
    const { amount } = body;
    
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Create checkout session using our library function
    try {
      const session = await createCheckoutSession(amount, user.id);
      
      // Return the checkout URL to redirect the user
      return NextResponse.json({ url: session.url });
    } catch (stripeError) {
      console.error("Stripe error:", stripeError);
      return NextResponse.json({ error: "Payment processing error" }, { status: 500 });
    }
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 