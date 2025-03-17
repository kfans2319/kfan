import { validateRequest } from "@/auth";
import TrendsSidebar from "@/components/TrendsSidebar";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import UserSubscriptionsClient from "@/app/(main)/subscriptions/UserSubscriptionsClient";

export const metadata: Metadata = {
  title: "Subscription Dashboard | KinkyFans ",
  description: "Manage your subscriptions to creators on KinkyFans.",
};

export default async function SubscriptionsPage() {
  const { user } = await validateRequest();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <main className="min-w-0 flex-1">
        <div className="border-b border-border/40 bg-muted/5">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Subscription Dashboard
            </h1>
            <p className="text-muted-foreground mt-2 max-w-[600px]">
              View and manage your creator subscriptions. Track your spending, manage auto-renewals, and see upcoming expirations. Click on your balance in the navbar to add to your balance.
            </p>
          </div>
        </div>
        
        <div className="px-4 sm:px-6 py-8">
          <UserSubscriptionsClient />
        </div>
      </main>
      
      <TrendsSidebar />
    </>
  );
} 