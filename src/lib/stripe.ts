import Stripe from 'stripe';
import prisma from '@/lib/prisma';

// Initialize Stripe with consistent API version
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

/**
 * Creates a Stripe checkout session
 * @param amount The amount to charge in dollars
 * @param userId The ID of the user making the payment
 * @returns Stripe Checkout Session
 */
export async function createCheckoutSession(amount: number, userId: string) {
  // Validate input
  if (typeof amount !== "number" || amount <= 0) {
    throw new Error("Invalid amount");
  }
  
  if (!userId) {
    throw new Error("User ID is required");
  }

  // Create session with consistent URLs and metadata
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(amount * 100), // Amount in cents, rounded to avoid fractions
          product_data: {
            name: 'Add Balance',
            description: `Add $${amount.toFixed(2)} to your wallet`,
          },
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/balance/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/balance/cancel`,
    metadata: {
      userId: userId,
      amount: amount.toString(),
    },
  });

  console.log(`Created checkout session for user ${userId} with amount ${amount}`);
  return session;
}

// Export the Stripe instance for direct access if needed
export default stripe; 