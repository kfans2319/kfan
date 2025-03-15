import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getUserDataSelect } from "@/lib/types";
import { redirect } from "next/navigation";
import AdminVerificationsList from "./AdminVerificationsList";

export const metadata = {
  title: "Admin Verification Dashboard - Bugbook",
  description: "Review and approve user identity verification requests",
};

export default async function AdminVerificationsPage({
  searchParams,
}: {
  searchParams: { status?: string };
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

  // Get the filter status from query params (default to PENDING)
  const status = searchParams.status || "PENDING";
  const validStatuses = ["PENDING", "APPROVED", "REJECTED", "ALL"];
  const filterStatus = validStatuses.includes(status) ? status : "PENDING";

  // Fetch verifications based on filter
  const where = filterStatus !== "ALL" ? { verificationStatus: filterStatus } : {};
  
  const pendingVerifications = await prisma.user.findMany({
    where,
    select: {
      ...getUserDataSelect(),
      verificationProcessor: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    },
    orderBy: { verificationSubmittedAt: "desc" },
  });

  return (
    <main className="grow space-y-5">
      <div className="rounded-2xl bg-card p-5 shadow-sm">
        <h1 className="mb-5 text-3xl font-bold">Verification Dashboard</h1>
        
        <AdminVerificationsList 
          verifications={pendingVerifications}
          currentFilter={filterStatus}
        />
      </div>
    </main>
  );
} 