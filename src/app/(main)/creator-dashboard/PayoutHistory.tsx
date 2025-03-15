"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ChevronLeft, ChevronRight, Calendar, CreditCard, AlertCircle, Check, X, Clock, Info, Wallet, Landmark } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface PayoutHistoryProps {
  userId: string;
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
  processor: {
    id: string;
    username: string;
    displayName: string;
  } | null;
}

interface PayoutHistoryResponse {
  payoutRequests: PayoutRequest[];
  totalPages: number;
  totalCount: number;
}

export default function PayoutHistory({ userId }: PayoutHistoryProps) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(5);
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);
  
  // Fetch payout history
  const { data, isLoading } = useQuery<PayoutHistoryResponse>({
    queryKey: ["payoutRequests", userId, page, pageSize],
    queryFn: async () => {
      const response = await fetch(`/api/creator/payouts?page=${page}&limit=${pageSize}`);
      if (!response.ok) {
        throw new Error("Failed to fetch payout history");
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  const payoutRequests = data?.payoutRequests || [];
  const totalPages = data?.totalPages || 1;
  const totalCount = data?.totalCount || 0;
  
  const handlePrevPage = () => {
    setPage((prev) => Math.max(prev - 1, 1));
  };
  
  const handleNextPage = () => {
    setPage((prev) => Math.min(prev + 1, totalPages));
  };

  const viewPayoutDetails = (payout: PayoutRequest) => {
    setSelectedPayout(payout);
  };
  
  // Get status badge variant based on status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
            <Check className="h-3.5 w-3.5 mr-1" />
            Approved
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">
            <X className="h-3.5 w-3.5 mr-1" />
            Rejected
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">
            <Check className="h-3.5 w-3.5 mr-1" />
            Completed
          </Badge>
        );
      case "PENDING":
      default:
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
            <Clock className="h-3.5 w-3.5 mr-1" />
            Pending
          </Badge>
        );
    }
  };
  
  // Get payout method badge based on method
  const getPayoutMethodBadge = (method: string) => {
    switch (method) {
      case "ETH_WALLET":
        return (
          <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800">
            <Wallet className="h-3.5 w-3.5 mr-1" />
            ETH Wallet
          </Badge>
        );
      case "BANK":
      default:
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">
            <Landmark className="h-3.5 w-3.5 mr-1" />
            Bank Account
          </Badge>
        );
    }
  };
  
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        ) : payoutRequests.length === 0 ? (
          <div className="text-center py-8 bg-muted/40 rounded-lg">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No payout requests found</p>
            <p className="text-sm text-muted-foreground mt-1">
              When you request a payout, it will appear here
            </p>
          </div>
        ) : (
          <>
            {/* Desktop view */}
            {!isMobile && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Processed Date</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payoutRequests.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell>
                          {format(new Date(payout.requestedAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(payout.amount)}
                        </TableCell>
                        <TableCell>
                          {getPayoutMethodBadge(payout.payoutMethod)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(payout.status)}
                        </TableCell>
                        <TableCell>
                          {payout.processedAt 
                            ? format(new Date(payout.processedAt), "MMM d, yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => viewPayoutDetails(payout)}
                          >
                            <Info className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {/* Mobile card view */}
            {isMobile && (
              <div className="space-y-3">
                {payoutRequests.map((payout) => (
                  <div 
                    key={payout.id} 
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {formatCurrency(payout.amount)}
                        </span>
                      </div>
                      {getStatusBadge(payout.status)}
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        Requested: {format(new Date(payout.requestedAt), "MMM d, yyyy")}
                      </div>
                      <div>{getPayoutMethodBadge(payout.payoutMethod)}</div>
                    </div>
                    
                    {payout.processedAt && (
                      <div className="flex items-center justify-between text-sm border-t pt-2 mt-2">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          Processed: {format(new Date(payout.processedAt), "MMM d, yyyy")}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => viewPayoutDetails(payout)}
                          className="h-7 px-2"
                        >
                          <Info className="h-3.5 w-3.5 mr-1" />
                          Details
                        </Button>
                      </div>
                    )}

                    {!payout.processedAt && (
                      <div className="flex justify-end mt-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => viewPayoutDetails(payout)}
                          className="h-7 px-2"
                        >
                          <Info className="h-3.5 w-3.5 mr-1" />
                          Details
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-2">
                <div className="text-sm text-muted-foreground order-2 sm:order-1">
                  Showing {payoutRequests.length} of {totalCount} payout requests
                </div>
                <div className="flex items-center space-x-2 order-1 sm:order-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevPage}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    {isMobile ? "" : "Previous"}
                  </Button>
                  <div className="text-sm">
                    Page {page} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={page === totalPages}
                  >
                    {isMobile ? "" : "Next"}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Payout Details Dialog */}
            {selectedPayout && (
              <Dialog open={!!selectedPayout} onOpenChange={(open) => !open && setSelectedPayout(null)}>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Payout Request Details</DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-2">
                    <div className="flex justify-between items-center">
                      <div className="text-lg font-semibold">
                        {formatCurrency(selectedPayout.amount)}
                      </div>
                      {getStatusBadge(selectedPayout.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Requested:</span>
                        <div className="font-medium">
                          {format(new Date(selectedPayout.requestedAt), "MMM d, yyyy")}
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-muted-foreground">Method:</span>
                        <div className="font-medium flex items-center mt-1">
                          {selectedPayout.payoutMethod === "BANK" ? (
                            <><Landmark className="h-3.5 w-3.5 mr-1 text-muted-foreground" />Bank Account</>
                          ) : (
                            <><Wallet className="h-3.5 w-3.5 mr-1 text-muted-foreground" />ETH Wallet</>
                          )}
                        </div>
                      </div>
                      
                      {selectedPayout.processedAt && (
                        <div>
                          <span className="text-muted-foreground">Processed:</span>
                          <div className="font-medium">
                            {format(new Date(selectedPayout.processedAt), "MMM d, yyyy")}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {selectedPayout.processor && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Processed by:</span>
                        <div className="font-medium">
                          {selectedPayout.processor.displayName}
                        </div>
                      </div>
                    )}
                    
                    {selectedPayout.notes && (
                      <div className="mt-4 text-sm">
                        <div className="text-muted-foreground mb-1">Notes:</div>
                        <div className="p-3 rounded-md bg-muted/30 border">
                          {selectedPayout.notes}
                        </div>
                      </div>
                    )}

                    {selectedPayout.status === "REJECTED" && !selectedPayout.notes && (
                      <div className="mt-4 text-sm">
                        <div className="p-3 rounded-md bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800">
                          Your payout request was rejected. No reason was provided.
                        </div>
                      </div>
                    )}

                    {selectedPayout.status === "PENDING" && (
                      <div className="mt-4 text-sm">
                        <div className="p-3 rounded-md bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          Your payout request is pending admin approval. This usually takes 1-3 business days.
                        </div>
                      </div>
                    )}

                    {selectedPayout.payoutMethod === "ETH_WALLET" && selectedPayout.ethWalletAddress && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">ETH Wallet Address:</span>
                        <div className="font-mono bg-muted/30 p-2 rounded-md mt-1 text-xs overflow-x-auto">
                          {selectedPayout.ethWalletAddress}
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
} 