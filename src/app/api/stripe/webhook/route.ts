import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Disable body parsing using modern App Router config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = headers().get("stripe-signature");
    
    if (!signature) {
      console.error("No Stripe signature found in request");
      return NextResponse.json({ error: "No signature provided" }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const error = err as Error;
      console.error("Webhook signature verification failed:", error.message);
      return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 });
    }

    console.log(`Processing Stripe webhook: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const amount = session.metadata?.amount;

      console.log(`Session details - ID: ${session.id}, UserID: ${userId}, Amount: ${amount}`);

      if (!userId || !amount) {
        console.error("Missing metadata in Stripe session");
        return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
      }

      // Convert amount to a number and update user's balance
      try {
        const amountNumber = parseFloat(amount);
        await prisma.user.update({
          where: { id: userId },
          data: {
            balance: {
              increment: amountNumber,
            },
          },
        });
        
        console.log(`Successfully updated balance for user ${userId} with amount ${amountNumber}`);
      } catch (dbError) {
        console.error("Database error:", dbError);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
    } else {
      // Log unhandled event types but still return success
      console.log(`Unhandled event type: ${event.type}`);
    }

    // Always return a success response for all event types
    // This prevents Stripe from retrying the webhook
    return NextResponse.json({ received: true, success: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 