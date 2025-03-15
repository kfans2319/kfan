import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import BankingDashboardClient from "./BankingDashboardClient";

export const metadata = {
  title: "Banking Dashboard - Admin | bugbook",
  description: "Manage user banking information for payouts",
};

export default async function AdminBankingPage({
  searchParams,
}: {
  searchParams: { page?: string; limit?: string; };
}) {
  const { user } = await validateRequest();

  if (!user) return redirect("/login");

  // Check if the user is an admin
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });

  if (!userData?.isAdmin) {
    // If not an admin, redirect to home page
    return redirect("/");
  }

  // Parse pagination parameters
  const page = parseInt(searchParams.page || "1");
  const limit = parseInt(searchParams.limit || "10");
  const skip = (page - 1) * limit;

  // Fetch users with bank information
  const [usersWithBankInfo, totalCount] = await Promise.all([
    prisma.bankInformation.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.bankInformation.count(),
  ]);

  // Format the data for the client component
  const bankInfoData = usersWithBankInfo.map(info => ({
    id: info.id,
    userId: info.userId,
    username: info.user.username,
    displayName: info.user.displayName,
    avatarUrl: info.user.avatarUrl,
    isVerified: info.user.isVerified,
    bankType: info.bankType || "DOMESTIC", // Default to DOMESTIC for backward compatibility
    bankName: info.bankName,
    accountHolderName: info.accountHolderName,
    // Mask account and routing numbers for security
    accountNumber: maskAccountNumber(info.accountNumber),
    routingNumber: info.routingNumber ? maskRoutingNumber(info.routingNumber) : "",
    createdAt: info.createdAt.toISOString(),
    updatedAt: info.updatedAt.toISOString(),
  }));

  return (
    <main className="grow space-y-5">
      <div className="rounded-2xl bg-card p-5 shadow-sm">
        <h1 className="mb-5 text-3xl font-bold">Banking Dashboard</h1>
        
        <BankingDashboardClient 
          bankInfoData={bankInfoData}
          pagination={{
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
          }}
        />
      </div>
    </main>
  );
}

// Helper functions for masking sensitive data
function maskAccountNumber(accountNumber: string): string {
  const length = accountNumber.length;
  if (length <= 4) return "****";
  
  const lastFour = accountNumber.slice(-4);
  return `****${lastFour}`;
}

function maskRoutingNumber(routingNumber: string): string {
  return routingNumber.slice(0, 3) + "******";
} 