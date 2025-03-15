// Script to simulate a subscription purchase to test our implementation
const { PrismaClient } = require('@prisma/client');

async function testSubscription() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Starting test subscription purchase...');
    
    // 1. Find a subscription tier
    const tier = await prisma.subscriptionTier.findFirst({
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            balance: true,
            earningsBalance: true
          }
        }
      }
    });
    
    if (!tier) {
      console.log('No subscription tiers found. Please create a tier first.');
      return;
    }
    
    console.log(`Found tier: ${tier.name} by ${tier.creator.username} for ${tier.price}`);
    
    // 2. Find a user other than the creator to subscribe
    const subscriber = await prisma.user.findFirst({
      where: {
        id: { not: tier.creatorId },
        balance: { gte: tier.price }
      },
      select: {
        id: true,
        username: true,
        balance: true
      }
    });
    
    if (!subscriber) {
      console.log('No eligible subscribers found. Please ensure a user has enough balance.');
      return;
    }
    
    console.log(`Found subscriber: ${subscriber.username} with balance ${subscriber.balance}`);
    
    // 3. Calculate platform fee and creator earnings
    const price = parseFloat(tier.price);
    const platformFee = (price * 15) / 100;
    const creatorEarnings = price - platformFee;
    
    console.log(`Price: ${price}, Platform Fee: ${platformFee}, Creator Earnings: ${creatorEarnings}`);
    
    // 4. Before state
    console.log('\nBefore subscription:');
    console.log(`Subscriber ${subscriber.username} balance: ${subscriber.balance}`);
    console.log(`Creator ${tier.creator.username} regular balance: ${tier.creator.balance}`);
    console.log(`Creator ${tier.creator.username} earnings balance: ${tier.creator.earningsBalance}`);
    
    // 5. Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + (tier.duration || 1));
    
    // 6. Execute the subscription purchase in a transaction
    const result = await prisma.$transaction([
      // Deduct from subscriber's balance
      prisma.user.update({
        where: { id: subscriber.id },
        data: {
          balance: {
            decrement: price
          }
        }
      }),
      // Add to creator's earnings balance (after deducting platform fee)
      prisma.user.update({
        where: { id: tier.creatorId },
        data: {
          earningsBalance: {
            increment: creatorEarnings
          }
        }
      }),
      // Create the subscription
      prisma.subscription.create({
        data: {
          subscriberId: subscriber.id,
          tierId: tier.id,
          expiresAt,
          autoRenew: true
        }
      })
    ]);
    
    // Get the newly created subscription
    const subscription = result[2];
    
    // Create a creator earning record to track this payment
    await prisma.creatorEarning.create({
      data: {
        creatorId: tier.creatorId,
        subscriberId: subscriber.id,
        subscriptionId: subscription.id,
        amount: creatorEarnings,
        platformFee: platformFee,
      }
    });
    
    // 7. After state
    const updatedSubscriber = await prisma.user.findUnique({
      where: { id: subscriber.id },
      select: { username: true, balance: true }
    });
    
    const updatedCreator = await prisma.user.findUnique({
      where: { id: tier.creatorId },
      select: { username: true, balance: true, earningsBalance: true }
    });
    
    console.log('\nAfter subscription:');
    console.log(`Subscriber ${updatedSubscriber.username} balance: ${updatedSubscriber.balance}`);
    console.log(`Creator ${updatedCreator.username} regular balance: ${updatedCreator.balance}`);
    console.log(`Creator ${updatedCreator.username} earnings balance: ${updatedCreator.earningsBalance}`);
    
    console.log('\nSubscription created successfully!');
    console.log(`Subscription ID: ${subscription.id}`);
    console.log(`Expires at: ${subscription.expiresAt}`);
    
  } catch (error) {
    console.error('Error during test subscription:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSubscription()
  .then(() => console.log('Test script execution completed.'))
  .catch(e => console.error('Test script execution failed:', e)); 