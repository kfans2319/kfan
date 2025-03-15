import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getUserDataSelect } from "@/lib/types";
import { redirect } from "next/navigation";
import VerificationForm from "./VerificationForm";

export const metadata = {
  title: "Verify Your Identity - KFans",
  description: "Upload your ID and selfie to verify your identity on KFans",
};

export default async function VerificationPage() {
  const { user } = await validateRequest();

  if (!user) return redirect("/login");

  // Get the user data to check verification status
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      ...getUserDataSelect(),
      verificationStatus: true,
      verificationSubmittedAt: true,
    },
  });

  if (!userData) return redirect("/login");

  // Debug - log user info
  console.log("User verification status:", {
    id: user.id,
    username: userData.username,
    verificationStatus: userData.verificationStatus,
  });

  return (
    <main className="mx-auto max-w-5xl grow px-4">
      <div className="rounded-xl bg-card p-6 shadow-sm sm:p-8">
        <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Identity Verification</h1>
        
        {userData.verificationStatus === "APPROVED" ? (
          <div className="rounded-lg bg-green-50 p-5 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-green-100 p-1 dark:bg-green-800">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-300">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                  <path d="m9 12 2 2 4-4"></path>
                </svg>
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-green-800 dark:text-green-200">
                  Verification Approved
                </h2>
                <p className="text-green-700 dark:text-green-300">
                  Your identity has been verified. You can now post content on the platform.
                </p>
              </div>
            </div>
          </div>
        ) : userData.verificationStatus === "PENDING" ? (
          <div className="rounded-lg bg-amber-50 p-5 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-1 dark:bg-amber-800">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-300">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                  <path d="M12 8v4"></path>
                  <path d="M12 16h.01"></path>
                </svg>
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200">
                  Verification Pending
                </h2>
                <p className="text-amber-700 dark:text-amber-300">
                  Your verification request has been submitted and is pending review.
                  We'll notify you once it's processed.
                </p>
                <p className="text-sm text-amber-600/80 dark:text-amber-400/80">
                  Submitted on: {userData.verificationSubmittedAt?.toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        ) : userData.verificationStatus === "REJECTED" ? (
          <div className="space-y-6">
            <div className="rounded-lg bg-red-50 p-5 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-red-100 p-1 dark:bg-red-800">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-300">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                    <path d="m15 9-6 6"></path>
                    <path d="m9 9 6 6"></path>
                  </svg>
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
                    Verification Rejected
                  </h2>
                  <p className="text-red-700 dark:text-red-300">
                    Your previous verification request was rejected. Please submit a new request
                    with clear images of your ID and selfie.
                  </p>
                </div>
              </div>
            </div>
            <VerificationForm userId={user.id} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg bg-blue-50 p-5 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-blue-100 p-1 dark:bg-blue-800">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-300">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                    <path d="M12 16v.01"></path>
                    <path d="M12 8v4"></path>
                  </svg>
                </div>
                <div className="space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                      Why Verify?
                    </h2>
                    <p className="mt-1 text-blue-700 dark:text-blue-300">
                      Identity verification helps us maintain a safe and trusted community.
                      You must be verified before you can post content on our platform.
                    </p>
                  </div>
                  
                  <ul className="space-y-1.5">
                    <li className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 dark:text-blue-400">
                        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                        <path d="m9 12 2 2 4-4"></path>
                      </svg>
                      Helps prevent spam and fake accounts
                    </li>
                    <li className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 dark:text-blue-400">
                        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                        <path d="m9 12 2 2 4-4"></path>
                      </svg>
                      Creates a trusted environment for all users
                    </li>
                    <li className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 dark:text-blue-400">
                        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                        <path d="m9 12 2 2 4-4"></path>
                      </svg>
                      Required to post content on the platform
                    </li>
                  </ul>
                  
                  <p className="mt-1 text-sm text-blue-600/80 dark:text-blue-400/80">
                    Your ID information is securely stored and only used for verification purposes.
                  </p>
                </div>
              </div>
            </div>
            
            <VerificationForm userId={user.id} />
          </div>
        )}
      </div>
    </main>
  );
} 