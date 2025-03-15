"use client";

import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import UserAvatar from "@/components/UserAvatar";
import { Check, Clock, X, CreditCard, Building, User, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

interface BankInformation {
  id: string;
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  accountHolderName: string;
  bankType?: "DOMESTIC" | "INTERNATIONAL";
  swiftCode?: string;
  iban?: string;
  bankAddress?: string;
  accountHolderAddress?: string;
  intermediaryBankName?: string;
  intermediaryBankSwiftCode?: string;
}

interface PayoutUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  bankInformation: BankInformation | null;
}

interface ProcessorUser {
  id: string;
  username: string;
  displayName: string;
}

interface PayoutRequest {
  id: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
  payoutMethod: "BANK" | "ETH_WALLET";
  ethWalletAddress: string | null;
  requestedAt: string;
  processedAt: string | null;
  notes: string | null;
  userId: string;
  processorId: string | null;
  user: PayoutUser;
  processor: ProcessorUser | null;
}

interface PayoutDetailDialogProps {
  payout: PayoutRequest;
  onClose: () => void;
  onUpdateStatus: (payoutId: string, status: string, notes?: string) => void;
  isUpdating: boolean;
}

export default function PayoutDetailDialog({
  payout,
  onClose,
  onUpdateStatus,
  isUpdating
}: PayoutDetailDialogProps) {
  const [notes, setNotes] = useState<string>(payout.notes || "");
  const [isActionMode, setIsActionMode] = useState<boolean>(false);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(null);

  // Get status badge based on status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
            Approved
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">
            Rejected
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">
            Completed
          </Badge>
        );
      case "PENDING":
      default:
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
            Pending
          </Badge>
        );
    }
  };

  // Handle status update button click
  const handleActionClick = (type: "APPROVE" | "REJECT") => {
    setActionType(type);
    setIsActionMode(true);
  };

  // Handle status update confirmation
  const handleSubmitAction = () => {
    if (!actionType) return;
    
    const status = actionType === "APPROVE" ? "APPROVED" : "REJECTED";
    onUpdateStatus(payout.id, status, notes);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Payout Request Details</DialogTitle>
        </DialogHeader>
        
        {/* Creator information */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <UserAvatar 
              avatarUrl={payout.user.avatarUrl}
              className="h-12 w-12"
            />
            <div>
              <h3 className="font-medium">{payout.user.displayName}</h3>
              <p className="text-sm text-muted-foreground">@{payout.user.username}</p>
            </div>
          </div>
          <div>
            {getStatusBadge(payout.status)}
          </div>
        </div>
        
        {/* Main details */}
        <div className="grid gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payout Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="font-medium">{formatCurrency(payout.amount)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>{getStatusBadge(payout.status)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Method</dt>
                  <dd className="font-medium flex items-center gap-1 mt-1">
                    {(payout.payoutMethod || "BANK") === "BANK" ? (
                      <><Building className="h-3.5 w-3.5 text-muted-foreground" /> Bank Account</>
                    ) : (
                      <><Wallet className="h-3.5 w-3.5 text-muted-foreground" /> ETH Wallet</>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Requested</dt>
                  <dd>{format(new Date(payout.requestedAt), "MMM d, yyyy")}</dd>
                </div>
                {payout.processedAt && (
                  <div>
                    <dt className="text-muted-foreground">Processed</dt>
                    <dd>{format(new Date(payout.processedAt), "MMM d, yyyy")}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
          
          {/* Bank information */}
          {(!payout.payoutMethod || payout.payoutMethod === "BANK") && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  {payout.user.bankInformation?.bankType === "INTERNATIONAL" ? (
                    <>International Bank Information</>
                  ) : (
                    <>Domestic Bank Information</>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {payout.user.bankInformation ? (
                  <dl className="grid grid-cols-2 gap-y-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Bank Name</dt>
                      <dd className="font-medium">{payout.user.bankInformation.bankName}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Account Number</dt>
                      <dd className="font-medium">{payout.user.bankInformation.accountNumber}</dd>
                    </div>
                    
                    {payout.user.bankInformation.routingNumber && (
                      <div>
                        <dt className="text-muted-foreground">Routing Number</dt>
                        <dd className="font-medium">{payout.user.bankInformation.routingNumber}</dd>
                      </div>
                    )}
                    
                    <div>
                      <dt className="text-muted-foreground">Account Holder</dt>
                      <dd className="font-medium">{payout.user.bankInformation.accountHolderName}</dd>
                    </div>
                    
                    {/* International bank details */}
                    {payout.user.bankInformation.bankType === "INTERNATIONAL" && (
                      <>
                        {payout.user.bankInformation.swiftCode && (
                          <div>
                            <dt className="text-muted-foreground">SWIFT/BIC Code</dt>
                            <dd className="font-medium">{payout.user.bankInformation.swiftCode}</dd>
                          </div>
                        )}
                        
                        {payout.user.bankInformation.iban && (
                          <div>
                            <dt className="text-muted-foreground">IBAN</dt>
                            <dd className="font-medium">{payout.user.bankInformation.iban}</dd>
                          </div>
                        )}
                        
                        {payout.user.bankInformation.bankAddress && (
                          <div className="col-span-2">
                            <dt className="text-muted-foreground">Bank Address</dt>
                            <dd className="font-medium">{payout.user.bankInformation.bankAddress}</dd>
                          </div>
                        )}
                        
                        {payout.user.bankInformation.accountHolderAddress && (
                          <div className="col-span-2">
                            <dt className="text-muted-foreground">Account Holder Address</dt>
                            <dd className="font-medium">{payout.user.bankInformation.accountHolderAddress}</dd>
                          </div>
                        )}
                        
                        {/* Intermediary bank info if available */}
                        {(payout.user.bankInformation.intermediaryBankName || payout.user.bankInformation.intermediaryBankSwiftCode) && (
                          <div className="col-span-2 mt-2 pt-2 border-t">
                            <dt className="text-muted-foreground font-medium">Intermediary Bank Information</dt>
                            {payout.user.bankInformation.intermediaryBankName && (
                              <dd className="font-medium mt-1">
                                <span className="text-muted-foreground">Name:</span> {payout.user.bankInformation.intermediaryBankName}
                              </dd>
                            )}
                            {payout.user.bankInformation.intermediaryBankSwiftCode && (
                              <dd className="font-medium mt-1">
                                <span className="text-muted-foreground">SWIFT/BIC:</span> {payout.user.bankInformation.intermediaryBankSwiftCode}
                              </dd>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">No bank information provided</p>
                )}
                
                {/* Processing notice for international transfers */}
                {payout.user.bankInformation?.bankType === "INTERNATIONAL" && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      International bank transfers may take 5-7 business days to process and may incur additional fees.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* ETH Wallet Information */}
          {payout.payoutMethod === "ETH_WALLET" && payout.ethWalletAddress && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Ethereum Wallet
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="gap-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground mb-1">Wallet Address</dt>
                    <dd className="font-mono bg-muted/20 p-3 rounded-md break-all border border-border/40">
                      {payout.ethWalletAddress}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
          
          {/* Notes section */}
          {isActionMode ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {actionType === "APPROVE" ? "Approve Payout" : "Reject Payout"}
                </CardTitle>
                <CardDescription>
                  {actionType === "APPROVE" 
                    ? "Enter any notes for approving this payout request."
                    : "Please provide a reason for rejecting this payout request."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Enter notes (optional for approval, required for rejection)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[100px]"
                  required={actionType === "REJECT"}
                />
              </CardContent>
            </Card>
          ) : payout.notes ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{payout.notes}</p>
              </CardContent>
            </Card>
          ) : null}
          
          {/* Processor information if processed */}
          {payout.processor && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Processed By
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {payout.processor.displayName} (@{payout.processor.username})
                </p>
                {payout.processedAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <Clock className="h-3.5 w-3.5 inline mr-1" />
                    {format(new Date(payout.processedAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        
        <DialogFooter className="sm:justify-between mt-4 gap-2">
          {isActionMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsActionMode(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                variant={actionType === "APPROVE" ? "default" : "destructive"}
                onClick={handleSubmitAction}
                disabled={isUpdating || (actionType === "REJECT" && !notes.trim())}
                className={actionType === "APPROVE" ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {isUpdating ? (
                  "Processing..."
                ) : actionType === "APPROVE" ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Confirm Approval
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 mr-1" />
                    Confirm Rejection
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
              
              {payout.status === "PENDING" && (
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleActionClick("APPROVE")}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleActionClick("REJECT")}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 