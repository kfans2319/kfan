"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import UserAvatar from "@/components/UserAvatar";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Check, X, Clock, ChevronLeft, ChevronRight, CalendarDays, Building, Eye, Wallet } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import PayoutDetailDialog from "./PayoutDetailDialog";

// Type definitions
interface BankInformation {
  id: string;
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  accountHolderName: string;
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

interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface PayoutsDashboardClientProps {
  initialPayouts: PayoutRequest[];
  initialPagination: PaginationMeta;
}

export default function PayoutsDashboardClient({
  initialPayouts,
  initialPagination,
}: PayoutsDashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isTablet = useMediaQuery("(max-width: 1024px)");
  const { toast } = useToast();
  
  // State
  const [payouts, setPayouts] = useState<PayoutRequest[]>(initialPayouts);
  const [pagination, setPagination] = useState<PaginationMeta>(initialPagination);
  const [currentStatus, setCurrentStatus] = useState<string>("PENDING");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage <= 0 || newPage > pagination.totalPages) return;
    fetchPayouts(newPage, currentStatus);
  };

  // Handle status filter change
  const handleStatusChange = (status: string) => {
    setCurrentStatus(status);
    fetchPayouts(1, status);
  };

  // Fetch payouts with filters
  const fetchPayouts = async (page: number, status: string = "PENDING") => {
    setIsLoading(true);
    
    try {
      const apiUrl = new URL("/api/admin/payouts", window.location.origin);
      apiUrl.searchParams.set("page", page.toString());
      apiUrl.searchParams.set("limit", "10");
      
      if (status !== "ALL") {
        apiUrl.searchParams.set("status", status);
      }
      
      // Update the URL
      const urlWithFilters = new URL(window.location.pathname, window.location.origin);
      urlWithFilters.searchParams.set("page", page.toString());
      if (status !== "PENDING") {
        urlWithFilters.searchParams.set("status", status);
      } else {
        urlWithFilters.searchParams.delete("status");
      }
      
      router.push(urlWithFilters.pathname + urlWithFilters.search);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error("Failed to fetch payouts");
      }
      
      const data = await response.json();
      setPayouts(data.payouts);
      setPagination(data.meta);
    } catch (error) {
      console.error("Error fetching payouts:", error);
      toast({
        title: "Error",
        description: "Failed to load payout requests",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle payout status update
  const handleUpdateStatus = async (payoutId: string, status: string, notes?: string) => {
    setIsUpdating(true);
    
    try {
      const response = await fetch("/api/admin/payouts/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payoutId, status, notes }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update payout status");
      }
      
      const data = await response.json();
      
      // Update the local state
      setPayouts(prevPayouts => 
        prevPayouts.map(p => 
          p.id === payoutId ? data.payout : p
        )
      );
      
      // Close the detail view
      setSelectedPayout(null);
      
      // Show success message
      toast({
        title: "Success",
        description: data.message,
      });
      
      // Refresh the list
      fetchPayouts(pagination.currentPage, currentStatus);
    } catch (error) {
      console.error("Error updating payout status:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update payout status",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // View payout details
  const handleViewPayout = (payout: PayoutRequest) => {
    setSelectedPayout(payout);
  };

  // Get status badge
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

  // Get payment method display
  const getPaymentMethodDisplay = (payout: PayoutRequest) => {
    // Default to bank for older records that don't have payoutMethod
    const method = payout.payoutMethod || "BANK";
    
    if (method === "ETH_WALLET") {
      return (
        <div className="flex items-center">
          <Wallet className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> ETH
        </div>
      );
    }
    
    return (
      <div className="flex items-center">
        <Building className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> Bank
      </div>
    );
  };

  // Sync with URL params on component mount
  useEffect(() => {
    const pageParam = searchParams?.get("page");
    const statusParam = searchParams?.get("status");
    
    const page = pageParam ? parseInt(pageParam) : 1;
    const status = statusParam || "PENDING";
    
    if (status !== currentStatus || page !== pagination.currentPage) {
      setCurrentStatus(status);
      fetchPayouts(page, status);
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Creator Payout Requests</h1>
          <p className="text-muted-foreground">Manage and process creator payout requests</p>
        </div>
        
        <Tabs 
          value={currentStatus} 
          onValueChange={handleStatusChange}
          className="w-full md:w-auto"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="PENDING">Pending</TabsTrigger>
            <TabsTrigger value="APPROVED">Approved</TabsTrigger>
            <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
            <TabsTrigger value="ALL">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <Separator />

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded-md w-48"></div>
            <div className="h-96 bg-muted rounded-md w-full"></div>
          </div>
        </div>
      ) : payouts.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium mb-2">No payout requests found</h3>
          <p className="text-muted-foreground">
            {currentStatus === "PENDING" 
              ? "There are no pending payout requests to process."
              : `There are no ${currentStatus.toLowerCase()} payout requests.`}
          </p>
        </div>
      ) : (
        <>
          {isTablet ? (
            // Mobile/Tablet Card View
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {payouts.map((payout) => (
                <Card key={payout.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <UserAvatar 
                          avatarUrl={payout.user.avatarUrl}
                          className="h-10 w-10"
                        />
                        <div>
                          <h3 className="font-medium">{payout.user.displayName}</h3>
                          <p className="text-sm text-muted-foreground">@{payout.user.username}</p>
                        </div>
                      </div>
                      {getStatusBadge(payout.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="grid grid-cols-2 gap-y-2 mb-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Amount</p>
                        <p className="font-medium">{formatCurrency(payout.amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Requested</p>
                        <div className="flex items-center">
                          <CalendarDays className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                          <p className="text-sm">
                            {format(new Date(payout.requestedAt), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Payment Method</p>
                        {getPaymentMethodDisplay(payout)}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Payment To</p>
                        <div className="flex items-center">
                          {(payout.payoutMethod || "BANK") === "BANK" ? (
                            <p className="text-sm truncate">
                              {payout.user.bankInformation ? 
                                payout.user.bankInformation.bankName : 
                                "No bank information"}
                            </p>
                          ) : (
                            <p className="text-sm truncate font-mono">
                              {payout.ethWalletAddress ? 
                                payout.ethWalletAddress.substring(0, 8) + "..." : 
                                "No wallet address"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => handleViewPayout(payout)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            // Desktop Table View
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatar 
                          avatarUrl={payout.user.avatarUrl}
                          className="h-8 w-8"
                        />
                        <div>
                          <p className="font-medium">{payout.user.displayName}</p>
                          <p className="text-sm text-muted-foreground">@{payout.user.username}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(payout.amount)}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <CalendarDays className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                        {format(new Date(payout.requestedAt), "MMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getPaymentMethodDisplay(payout)}
                    </TableCell>
                    <TableCell>{getStatusBadge(payout.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleViewPayout(payout)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={!pagination.hasPreviousPage}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Previous</span>
              </Button>
              <span className="text-sm">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={!pagination.hasNextPage}
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Next</span>
              </Button>
            </div>
          )}
        </>
      )}
      
      {/* Payout Detail Dialog */}
      {selectedPayout && (
        <PayoutDetailDialog
          payout={selectedPayout}
          onClose={() => setSelectedPayout(null)}
          onUpdateStatus={handleUpdateStatus}
          isUpdating={isUpdating}
        />
      )}
    </div>
  );
} 