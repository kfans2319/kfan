"use client";

import { UserData } from "@/lib/types";
import { formatDate } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserAvatar from "@/components/UserAvatar";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import LoadingButton from "@/components/LoadingButton";

type VerificationType = UserData & {
  verificationProcessor?: {
    id: string;
    username: string;
    displayName: string;
  } | null;
  verificationPose?: string;
};

interface AdminVerificationsListProps {
  verifications: VerificationType[];
  currentFilter: string;
}

export default function AdminVerificationsList({
  verifications,
  currentFilter,
}: AdminVerificationsListProps) {
  const router = useRouter();
  const [selectedVerification, setSelectedVerification] = useState<VerificationType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Handle status filter change
  const handleFilterChange = (value: string) => {
    router.push(`/admin/verifications?status=${value}`);
  };
  
  // Process verification (approve or reject)
  const processVerification = async (userId: string, status: "APPROVED" | "REJECTED") => {
    setIsProcessing(true);
    
    try {
      const response = await fetch("/api/admin/process-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          status,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to process verification");
      }
      
      // Close dialog and refresh page
      setSelectedVerification(null);
      router.refresh();
    } catch (error) {
      console.error("Error processing verification:", error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <>
      <div className="space-y-6">
        <Tabs defaultValue={currentFilter} onValueChange={handleFilterChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="PENDING">Pending</TabsTrigger>
            <TabsTrigger value="APPROVED">Approved</TabsTrigger>
            <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
            <TabsTrigger value="ALL">All</TabsTrigger>
          </TabsList>
          
          {verifications.length === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <p className="text-muted-foreground">No verification requests found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {verifications.map((verification) => (
                <div key={verification.id} className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      avatarUrl={verification.avatarUrl}
                      size={48}
                      className="size-12 flex-none rounded-full"
                    />
                    <div>
                      <div className="font-medium">{verification.displayName}</div>
                      <div className="text-sm text-muted-foreground">@{verification.username}</div>
                      <div className="mt-1 text-xs">
                        Submitted: {formatDate(new Date(verification.verificationSubmittedAt || ""), "MMM d, yyyy")}
                      </div>
                    </div>
                  </div>
                  
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {verification.verificationStatus === "PENDING" ? (
                      <Badge className="bg-yellow-500">Pending</Badge>
                    ) : verification.verificationStatus === "APPROVED" ? (
                      <Badge className="bg-green-500">Approved</Badge>
                    ) : (
                      <Badge className="bg-red-500">Rejected</Badge>
                    )}
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedVerification(verification)}
                    >
                      Review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Tabs>
      </div>
      
      {/* Verification Review Dialog */}
      {selectedVerification && (
        <Dialog open={!!selectedVerification} onOpenChange={() => setSelectedVerification(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Verification Details</DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* User information */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <UserAvatar 
                    avatarUrl={selectedVerification.avatarUrl} 
                    className="h-12 w-12" 
                  />
                  <div>
                    <h3 className="font-medium">{selectedVerification.displayName}</h3>
                    <p className="text-sm text-muted-foreground">@{selectedVerification.username}</p>
                  </div>
                </div>
                
                {/* Status badge */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge
                    variant={
                      selectedVerification.verificationStatus === "PENDING"
                        ? "outline"
                        : selectedVerification.verificationStatus === "APPROVED"
                        ? "default"
                        : "destructive"
                    }
                  >
                    {selectedVerification.verificationStatus}
                  </Badge>
                </div>
                
                {/* Verification pose information */}
                {selectedVerification.verificationPose && (
                  <div className="rounded-md bg-amber-50 p-3 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div className="text-sm font-medium text-amber-700 dark:text-amber-200">
                      Required Pose:
                    </div>
                    <div className="text-amber-800 dark:text-amber-100">
                      {selectedVerification.verificationPose}
                    </div>
                  </div>
                )}
                
                {/* Processor information */}
                {selectedVerification.verificationProcessor && (
                  <div className="rounded-md bg-muted p-3">
                    <div className="text-sm font-medium">Processed by:</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary-foreground">
                        {selectedVerification.verificationProcessor.username.charAt(0).toUpperCase()}
                      </div>
                      <span>
                        {selectedVerification.verificationProcessor.displayName || 
                          '@' + selectedVerification.verificationProcessor.username}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="text-sm text-muted-foreground">
                  Submitted: {selectedVerification.verificationSubmittedAt ? 
                    formatDate(new Date(selectedVerification.verificationSubmittedAt), 'PPP p') : 
                    'N/A'}
                </div>
              </div>
              
              {/* Verification images */}
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-sm font-medium">Selfie Image</h3>
                  {selectedVerification.selfieImageUrl ? (
                    <div className="relative aspect-square w-full overflow-hidden rounded-md border">
                      <Image
                        src={selectedVerification.selfieImageUrl}
                        alt="User selfie"
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-md border bg-muted/20">
                      <span className="text-sm text-muted-foreground">No selfie image</span>
                    </div>
                  )}
                </div>
                
                <div>
                  <h3 className="mb-2 text-sm font-medium">ID Document</h3>
                  {selectedVerification.idImageUrl ? (
                    <div className="relative aspect-video w-full overflow-hidden rounded-md border">
                      <Image
                        src={selectedVerification.idImageUrl}
                        alt="User ID"
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-md border bg-muted/20">
                      <span className="text-sm text-muted-foreground">No ID image</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Only show action buttons for pending verifications */}
            {selectedVerification.verificationStatus === "PENDING" && (
              <DialogFooter className="gap-2 sm:gap-0">
                <LoadingButton
                  variant="destructive"
                  onClick={() => processVerification(selectedVerification.id, "REJECTED")}
                  loading={isProcessing}
                  disabled={isProcessing}
                >
                  Reject
                </LoadingButton>
                <LoadingButton
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => processVerification(selectedVerification.id, "APPROVED")}
                  loading={isProcessing}
                  disabled={isProcessing}
                >
                  Approve
                </LoadingButton>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
} 