import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import PayoutsDashboardClient from "./PayoutsDashboardClient";

export const metadata = {
  title: "Admin Payout Requests Dashboard",
  description: "Manage creator payout requests",
};

/**
 * Fetch payout requests with pagination
 */
async function getPayoutRequests(page: number, limit: number) {
  // Build the API URL with pagination params
  const apiUrl = new URL("/api/admin/payouts", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000");
  apiUrl.searchParams.set("page", page.toString());
  apiUrl.searchParams.set("limit", limit.toString());
  
  // Fetch the payout requests
  const response = await fetch(apiUrl, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Error fetching payout requests:", errorText);
    return {
      payouts: [],
      meta: {
        currentPage: page,
        totalPages: 0,
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      }
    };
  }
  
  return await response.json();
}

export default async function PayoutsDashboardPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  // Validate user is authenticated and is an admin
  const { user } = await validateRequest();
  
  if (!user) {
    redirect("/");
  }

  // Check if user is an admin
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });

  if (!userData?.isAdmin) {
    redirect("/");
  }

  // Parse pagination params
  const page = searchParams.page ? parseInt(searchParams.page) : 1;
  const limit = 10;
  
  // Fetch initial payout data
  const payoutData = await getPayoutRequests(page, limit);

  return (
    <main className="grow space-y-5">
      <div className="rounded-2xl bg-card p-5 shadow-sm">
        <h1 className="mb-5 text-3xl font-bold">Payout Requests Dashboard</h1>
        
        <PayoutsDashboardClient 
          initialPayouts={payoutData.payouts} 
          initialPagination={payoutData.meta} 
        />
      </div>
    </main>
  );
} 