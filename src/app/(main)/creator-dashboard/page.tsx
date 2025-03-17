import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import TrendsSidebar from "@/components/TrendsSidebar";
import CreatorDashboardClient from "./CreatorDashboardClient";

export const metadata: Metadata = {
  title: "Creator Dashboard | KinkyFans",
  description: "Manage your creator earnings, view subscriber statistics, and request payouts.",
};

export default async function CreatorDashboardPage() {
  const { user } = await validateRequest();

  // Redirect to login if not authenticated
  if (!user) {
    redirect("/login");
  }

  // Get full user data including verification status
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      username: true,
      isVerified: true,
      verificationStatus: true,
      balance: true,
      earningsBalance: true,
      createdTiers: {
        select: {
          id: true,
          name: true,
          price: true,
          duration: true,
        },
      },
    },
  });

  // Redirect to verification page if not verified
  if (!userData || !userData.isVerified || userData.verificationStatus !== "APPROVED") {
    redirect("/verification?redirectTo=/creator-dashboard");
  }

  // Check if user has created any subscription tiers
  const hasTiers = userData.createdTiers.length > 0;
  
  // Convert Decimal objects to strings to avoid Next.js serialization errors
  const balance = userData.balance.toString();
  const earningsBalance = userData.earningsBalance.toString();
  
  // Also convert each tier's price from Decimal to string
  const tiers = userData.createdTiers.map(tier => ({
    ...tier,
    price: tier.price.toString()
  }));

  return (
    <>
      <main className="min-w-0 flex-1">
        <div className="border-b border-border/40 bg-muted/5">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
              Creator Dashboard
            </h1>
            <p className="text-muted-foreground mt-2 max-w-[600px] text-sm sm:text-base">
              Track your earnings, manage your subscriber base, and request payouts. Monitor your
              creator metrics to grow your audience.
            </p>
          </div>
        </div>
        
        <div className="px-4 sm:px-6 py-6 sm:py-8">
          <CreatorDashboardClient 
            userId={userData.id}
            username={userData.username}
            balance={balance}
            earningsBalance={earningsBalance}
            hasTiers={hasTiers}
            tiers={tiers}
          />
        </div>
      </main>
      
      <TrendsSidebar />
    </>
  );
} 