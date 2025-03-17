import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export async function createCheckoutSession(amount: number, userId: string) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: amount * 100, // Amount in cents
          product_data: {
            name: 'Add Balance',
          },
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.NEXTAUTH_URL}/profile?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXTAUTH_URL}/profile`,
    client_reference_id: userId,
  });

  return session;
}

// Helper function to get the raw request body
async function buffer(req: NextRequest) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req.body as any) {
    chunks.push(chunk instanceof Uint8Array ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function handleStripeWebhook(req: NextRequest) {
  const sig = req.headers.get('stripe-signature') as string;
  const rawBody = await buffer(req);

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const error = err as Error;
    console.error('Webhook error:', error);
    return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      
      if (!userId) {
        console.error('No user ID found in session');
        return NextResponse.json({ error: 'No user ID found in session' }, { status: 400 });
      }
      
      const amountTotal = session.amount_total;
      if (amountTotal === null) {
        console.error('No amount found in session');
        return NextResponse.json({ error: 'No amount found in session' }, { status: 400 });
      }
      
      const amount = amountTotal / 100; // Convert cents to dollars

      // Update user balance in the database
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { balance: { increment: amount } },
        });
      } catch (dbError) {
        console.error('Database error:', dbError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
} 