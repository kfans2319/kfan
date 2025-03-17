import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getUserDataSelect, UserData } from "@/lib/types";
import { redirect } from "next/navigation";
import AdminVerificationsList from "./AdminVerificationsList";
import { Prisma, VerificationStatus } from "@prisma/client";

// Define the verification type to match what the component expects
type VerificationType = UserData & {
  verificationProcessor?: {
    id: string;
    username: string;
    displayName: string;
  } | null;
  verificationPose?: string;
};

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

  // Build the query based on the status
  let where: Prisma.UserWhereInput = {};
  
  // Map string status to enum
  if (filterStatus === "PENDING") {
    where = { verificationStatus: VerificationStatus.PENDING };
  } else if (filterStatus === "APPROVED") {
    where = { verificationStatus: VerificationStatus.APPROVED };
  } else if (filterStatus === "REJECTED") {
    where = { verificationStatus: VerificationStatus.REJECTED };
  }
  // For "ALL", we leave where as an empty object

  // Get users with verification data
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

  // Cast the result to the expected type for the component
  const typedVerifications = pendingVerifications as any as VerificationType[];

  return (
    <main className="grow space-y-5">
      <div className="rounded-2xl bg-card p-5 shadow-sm">
        <h1 className="mb-5 text-3xl font-bold">Verification Dashboard</h1>
        
        <AdminVerificationsList 
          verifications={typedVerifications}
          currentFilter={filterStatus}
        />
      </div>
    </main>
  );
} 