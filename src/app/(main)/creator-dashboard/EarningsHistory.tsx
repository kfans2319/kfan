"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, ChevronLeft, ChevronRight, DollarSign, Calendar, User } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface EarningsHistoryProps {
  userId: string;
}

interface Earning {
  id: string;
  amount: number;
  platformFee: number;
  grossAmount: number;
  platformFeePercentage: number;
  earnedAt: string;
  subscriber?: {
    username: string;
  };
  subscription?: {
    tier: {
      name: string;
      price: number;
    };
  };
}

interface EarningsResponse {
  earnings: Earning[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  earningsBalance: number;
  platformFeePercentage: number;
}

export default function EarningsHistory({ userId }: EarningsHistoryProps) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(max-width: 1024px)");

  // Fetch earnings history
  const { data, isLoading, isFetching } = useQuery<EarningsResponse>({
    queryKey: ["creatorEarnings", userId, page, searchQuery],
    queryFn: async () => {
      const response = await fetch(
        `/api/creator/earnings?page=${page}&limit=${pageSize}${
          searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""
        }`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch earnings history");
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const earnings = data?.earnings || [];
  const totalPages = data?.meta?.totalPages || 1;
  const totalCount = data?.meta?.totalCount || 0;
  const platformFeePercentage = data?.platformFeePercentage || 15;

  const handlePrevPage = () => {
    setPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to first page when searching
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary hidden sm:block" />
            <h2 className="text-base sm:text-lg font-medium">Subscription Earnings</h2>
          </div>
          
          <form onSubmit={handleSearch} className="w-full sm:w-auto">
            <div className="relative max-w-xs w-full sm:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by username..."
                className="w-full pl-9 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>
        </div>
        
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="ml-auto">
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : earnings.length === 0 ? (
          <div className="text-center py-6 bg-muted/40 rounded-lg">
            <p className="text-muted-foreground">No earnings found</p>
            {searchQuery && (
              <Button
                variant="ghost"
                className="mt-2"
                onClick={() => setSearchQuery("")}
                size="sm"
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop and tablet view */}
            {!isMobile && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Subscriber</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Fee ({platformFeePercentage}%)</TableHead>
                      <TableHead className="text-right">Net Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earnings.map((earning) => (
                      <TableRow key={earning.id}>
                        <TableCell className="font-medium">
                          {earning.subscriber?.username || "Anonymous"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {earning.subscription?.tier?.name || "Standard"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(earning.earnedAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(earning.grossAmount)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(earning.platformFee)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(earning.amount)}
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
                {earnings.map((earning) => (
                  <div 
                    key={earning.id} 
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {earning.subscriber?.username || "Anonymous"}
                        </span>
                      </div>
                      <Badge variant="outline" className="font-normal">
                        {earning.subscription?.tier?.name || "Standard"}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(earning.earnedAt), "MMM d, yyyy")}
                      </div>
                      <div className="font-medium text-base">
                        {formatCurrency(earning.amount)}
                      </div>
                    </div>
                    
                    <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
                      <span>Gross: {formatCurrency(earning.grossAmount)}</span>
                      <span>Fee ({platformFeePercentage}%): {formatCurrency(earning.platformFee)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-2">
              <div className="text-sm text-muted-foreground order-2 sm:order-1">
                Showing {earnings.length} of {totalCount} earnings
              </div>
              <div className="flex items-center space-x-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={page === 1 || isFetching}
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
                  disabled={page === totalPages || isFetching}
                >
                  {isMobile ? "" : "Next"}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
} 