"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/UserAvatar";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Eye, ChevronDown, ChevronUp } from "lucide-react";
import BankDetailsDialog from "./BankDetailsDialog";
import { Card, CardContent } from "@/components/ui/card";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface BankInfoItem {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  bankType?: "DOMESTIC" | "INTERNATIONAL";
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  routingNumber: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

interface BankingDashboardClientProps {
  bankInfoData: BankInfoItem[];
  pagination: PaginationMeta;
}

export default function BankingDashboardClient({ 
  bankInfoData, 
  pagination 
}: BankingDashboardClientProps) {
  const router = useRouter();
  const [selectedBankInfo, setSelectedBankInfo] = useState<BankInfoItem | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(max-width: 1024px)");
  
  const handlePageChange = (page: number) => {
    router.push(`/admin/banking?page=${page}`);
  };
  
  const handleViewDetails = (bankInfo: BankInfoItem) => {
    setSelectedBankInfo(bankInfo);
    setShowDetailsDialog(true);
  };
  
  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => 
      prev.includes(id) 
        ? prev.filter(rowId => rowId !== id)
        : [...prev, id]
    );
  };
  
  const isRowExpanded = (id: string) => expandedRows.includes(id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <h2 className="text-xl font-semibold">User Banking Information</h2>
        <div className="text-sm text-muted-foreground">
          {pagination.totalCount} Total Records
        </div>
      </div>
      
      {bankInfoData.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No banking information found</p>
        </div>
      ) : isMobile ? (
        // Mobile card view
        <div className="space-y-4">
          {bankInfoData.map((bankInfo) => (
            <Card key={bankInfo.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <UserAvatar 
                      avatarUrl={bankInfo.avatarUrl}
                      className="h-10 w-10"
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{bankInfo.displayName}</span>
                      <span className="text-xs text-muted-foreground">@{bankInfo.username}</span>
                    </div>
                  </div>
                  {bankInfo.isVerified && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50 dark:bg-green-950/30 dark:text-green-400 border-green-200 dark:border-green-800">
                      Verified
                    </Badge>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mb-3">
                  <div>
                    <p className="text-muted-foreground">Bank Name</p>
                    <p className="font-medium">{bankInfo.bankName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Account Number</p>
                    <p className="font-medium">{bankInfo.accountNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Account Holder</p>
                    <p className="font-medium">{bankInfo.accountHolderName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <p className="font-medium">
                      {bankInfo.bankType === "INTERNATIONAL" ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                          International
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300 border-gray-200 dark:border-gray-800">
                          Domestic
                        </Badge>
                      )}
                    </p>
                  </div>
                </div>
                
                <Button 
                  className="w-full"
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleViewDetails(bankInfo)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View Details
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // Tablet and desktop table view
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">User</TableHead>
                <TableHead className={isTablet ? "hidden" : ""}>Bank Name</TableHead>
                <TableHead className={isTablet ? "hidden" : ""}>Account Holder</TableHead>
                <TableHead>Account Number</TableHead>
                <TableHead className={isTablet ? "hidden" : ""}>Type</TableHead>
                <TableHead className={isTablet ? "hidden" : ""}>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bankInfoData.map((bankInfo) => (
                <>
                  <TableRow key={bankInfo.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar 
                          avatarUrl={bankInfo.avatarUrl}
                          className="h-8 w-8"
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{bankInfo.displayName}</span>
                          <span className="text-xs text-muted-foreground">@{bankInfo.username}</span>
                        </div>
                        {bankInfo.isVerified && (
                          <Badge variant="outline" className="ml-1 bg-green-50 text-green-700 hover:bg-green-50 dark:bg-green-950/30 dark:text-green-400 border-green-200 dark:border-green-800">
                            Verified
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={isTablet ? "hidden" : ""}>{bankInfo.bankName}</TableCell>
                    <TableCell className={isTablet ? "hidden" : ""}>{bankInfo.accountHolderName}</TableCell>
                    <TableCell>{bankInfo.accountNumber}</TableCell>
                    <TableCell className={isTablet ? "hidden" : ""}>
                      {bankInfo.bankType === "INTERNATIONAL" ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                          International
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300 border-gray-200 dark:border-gray-800">
                          Domestic
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={isTablet ? "hidden" : ""}>{format(new Date(bankInfo.updatedAt), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      {isTablet ? (
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => toggleRowExpansion(bankInfo.id)}
                            className="h-8 w-8 p-0"
                          >
                            {isRowExpanded(bankInfo.id) ? 
                              <ChevronUp className="h-4 w-4" /> : 
                              <ChevronDown className="h-4 w-4" />
                            }
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleViewDetails(bankInfo)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleViewDetails(bankInfo)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {/* Expanded row for tablet view */}
                  {isTablet && isRowExpanded(bankInfo.id) && (
                    <TableRow>
                      <TableCell colSpan={4} className="bg-muted/20 px-4 py-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Bank Name:</span>
                            <span className="font-medium ml-2">{bankInfo.bankName}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Account Holder:</span>
                            <span className="font-medium ml-2">{bankInfo.accountHolderName}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Updated:</span>
                            <span className="font-medium ml-2">{format(new Date(bankInfo.updatedAt), "MMM d, yyyy")}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Routing Number:</span>
                            <span className="font-medium ml-2">{bankInfo.routingNumber}</span>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      
      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-2">
          <div className="text-sm text-muted-foreground order-1 sm:order-2 mb-2 sm:mb-0">
            Page {pagination.currentPage} of {pagination.totalPages}
          </div>
          <div className="flex items-center gap-2 order-2 sm:order-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
              className="h-8 w-8 p-0"
            >
              <ArrowRight className="h-4 w-4" />
              <span className="sr-only">Next</span>
            </Button>
          </div>
        </div>
      )}
      
      {/* Bank details dialog */}
      {selectedBankInfo && (
        <BankDetailsDialog
          bankInfo={selectedBankInfo}
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
        />
      )}
    </div>
  );
} 