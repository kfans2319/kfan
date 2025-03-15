"use client";

import { Button } from "@/components/ui/button";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  CreditCard, 
  Calendar, 
  RefreshCw, 
  ExternalLink, 
  Users, 
  Clock, 
  Eye,
  DollarSign
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { formatDate, format, addDays } from "date-fns";
import UserAvatar from "@/components/UserAvatar";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import LoadingButton from "@/components/LoadingButton";
import Link from "next/link";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export default function UserSubscriptionsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'auto-renew' | 'expiring'>('all');
  const [cancelSubscriptionId, setCancelSubscriptionId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(max-width: 1024px)");
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Set view mode based on screen size
  useEffect(() => {
    setViewMode(isMobile ? 'cards' : 'table');
  }, [isMobile]);

  // Get the page from URL or default to 1
  useEffect(() => {
    const pageParam = searchParams?.get("page");
    if (pageParam) {
      const parsedPage = parseInt(pageParam);
      if (!isNaN(parsedPage) && parsedPage > 0) {
        setPage(parsedPage);
      }
    }
    
    const filterParam = searchParams?.get("filter") as 'all' | 'auto-renew' | 'expiring' | null;
    if (filterParam && ['all', 'auto-renew', 'expiring'].includes(filterParam)) {
      setFilter(filterParam);
    }
  }, [searchParams]);

  // Update URL when page or filter changes
  const updateParams = (newPage: number, newFilter?: 'all' | 'auto-renew' | 'expiring') => {
    setPage(newPage);
    
    if (newFilter) {
      setFilter(newFilter);
    }
    
    const params = new URLSearchParams();
    // Copy current params
    if (searchParams) {
      for (const [key, value] of Array.from(searchParams.entries())) {
        if (key !== 'page' && key !== 'filter') {
          params.set(key, value);
        }
      }
    }
    params.set("page", newPage.toString());
    if (newFilter) {
      params.set("filter", newFilter);
    } else {
      params.set("filter", filter);
    }
    router.push(`/subscriptions?${params.toString()}`);
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      updateParams(page - 1);
    }
  };

  const handleNextPage = () => {
    if (meta?.hasNext) {
      updateParams(page + 1);
    }
  };

  // Fetch subscription data
  const { 
    subscriptions, 
    meta, 
    isLoading, 
    error, 
    cancelSubscription, 
    isCanceling 
  } = useSubscriptions(page);

  // Filter subscriptions based on selected filter
  const filteredSubscriptions = subscriptions.filter(sub => {
    if (filter === 'all') return true;
    if (filter === 'auto-renew') return sub.autoRenew;
    if (filter === 'expiring') {
      const expiresInDays = Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return expiresInDays <= 7 && !sub.autoRenew;
    }
    return true;
  });

  // Count by filter type for badges
  const counts = {
    all: subscriptions.length,
    'auto-renew': subscriptions.filter(sub => sub.autoRenew).length,
    expiring: subscriptions.filter(sub => {
      const expiresInDays = Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return expiresInDays <= 7 && !sub.autoRenew;
    }).length
  };

  // Calculate statistics for the dashboard
  const totalSpending = subscriptions.reduce((sum, sub) => sum + sub.tier.price, 0);
  const monthlySpending = subscriptions
    .filter(sub => sub.autoRenew)
    .reduce((sum, sub) => sum + (sub.tier.price / sub.tier.duration), 0);
  
  const autoRenewCount = subscriptions.filter(sub => sub.autoRenew).length;
  
  // Get next expiration
  const nextExpiration = subscriptions.length > 0 
    ? subscriptions.reduce((earliest, sub) => 
        new Date(sub.expiresAt) < new Date(earliest.expiresAt) ? sub : earliest
      )
    : null;

  // Format the next expiration date in a friendly way
  const formatNextExpiration = () => {
    if (!nextExpiration) return "No subscriptions";
    
    const expiresAt = new Date(nextExpiration.expiresAt);
    const today = new Date();
    const diffDays = Math.ceil((expiresAt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays <= 7) return `In ${diffDays} days`;
    return format(expiresAt, "MMM d, yyyy");
  };

  const handleCancelClick = (id: string) => {
    setCancelSubscriptionId(id);
    setIsDialogOpen(true);
  };

  const handleConfirmCancel = () => {
    if (cancelSubscriptionId) {
      cancelSubscription(cancelSubscriptionId);
      setIsDialogOpen(false);
      setCancelSubscriptionId(null);
    }
  };

  const handleViewDetails = (subscription: any) => {
    setSelectedSubscription(subscription);
    setShowDetailsDialog(true);
  };

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Subscriptions
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? (
                <div className="h-7 w-16 animate-pulse rounded bg-muted"></div>
              ) : (
                formatNumber(counts.all)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active creator subscriptions
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Spending
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? (
                <div className="h-7 w-24 animate-pulse rounded bg-muted"></div>
              ) : (
                formatCurrency(monthlySpending)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Recurring monthly payments
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Auto-Renewing
            </CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? (
                <div className="h-7 w-16 animate-pulse rounded bg-muted"></div>
              ) : (
                formatNumber(autoRenewCount)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Subscriptions set to auto-renew
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Next Expiration
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? (
                <div className="h-7 w-24  animate-pulse rounded bg-muted"></div>
              ) : (
                <div className="text-sm">{formatNextExpiration()}</div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {nextExpiration ? nextExpiration.tier.creator.displayName : "No subscriptions"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Your Subscriptions</h2>
          <div className="text-sm text-muted-foreground">
            {meta?.totalCount} Total Subscriptions
          </div>
        </div>

        <Tabs value={filter} onValueChange={(value) => updateParams(1, value as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">
              {isMobile ? "All" : "All Subscriptions"}
              {counts.all > 0 && (
                <Badge variant="secondary" className="ml-2">{counts.all}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="auto-renew">
              {isMobile ? "Auto-Renew" : "Auto-Renewing"}
              {counts["auto-renew"] > 0 && (
                <Badge variant="secondary" className="ml-2">{counts["auto-renew"]}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="expiring">
              {isMobile ? "Expiring" : "Expiring Soon"}
              {counts.expiring > 0 && (
                <Badge variant="secondary" className="ml-2">{counts.expiring}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-500">
            Error loading subscriptions. Please try again.
          </div>
        ) : filteredSubscriptions.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center">
            <p className="text-muted-foreground">No subscriptions found for the selected filter.</p>
            {filter !== 'all' && (
              <Button 
                variant="outline" 
                className="mt-4" 
                onClick={() => updateParams(1, 'all')}
              >
                View all subscriptions
              </Button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar 
                          avatarUrl={subscription.tier.creator.avatarUrl}
                          className="h-8 w-8"
                        />
                        <div className="font-medium">
                          {subscription.tier.creator.displayName}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{subscription.tier.name}</TableCell>
                    <TableCell>{formatCurrency(subscription.tier.price)}</TableCell>
                    <TableCell>
                      {format(new Date(subscription.expiresAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {subscription.autoRenew ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50 dark:bg-green-950/30 dark:text-green-400 border-green-200 dark:border-green-800">
                          Auto-Renew
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 hover:bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                          Expires Soon
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(subscription)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelClick(subscription.id)}
                      >
                        {subscription.autoRenew ? "Cancel" : "Manage"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredSubscriptions.map((subscription) => (
              <Card key={subscription.id} className="overflow-hidden">
                <CardHeader className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UserAvatar 
                        avatarUrl={subscription.tier.creator.avatarUrl}
                        className="h-10 w-10"
                      />
                      <div>
                        <CardTitle className="text-lg">{subscription.tier.creator.displayName}</CardTitle>
                        <CardDescription>@{subscription.tier.creator.username}</CardDescription>
                      </div>
                    </div>
                    {subscription.autoRenew ? (
                      <Badge variant="outline" className="ml-auto bg-green-50 text-green-700 hover:bg-green-50 dark:bg-green-950/30 dark:text-green-400 border-green-200 dark:border-green-800">
                        Auto-Renew
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="ml-auto bg-amber-50 text-amber-700 hover:bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                        Expires Soon
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">Tier</div>
                      <div className="font-medium">{subscription.tier.name}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Price</div>
                      <div className="font-medium">{formatCurrency(subscription.tier.price)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Renewal</div>
                      <div className="font-medium">{subscription.autoRenew ? "Auto-Renew" : "Manual"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Expires</div>
                      <div className="font-medium">{format(new Date(subscription.expiresAt), "MMM d, yyyy")}</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleViewDetails(subscription)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleCancelClick(subscription.id)}
                    >
                      {subscription.autoRenew ? "Cancel" : "Manage"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              Page {page} of {meta.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={page === meta.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Cancellation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this subscription? You'll still have access until the expiration date.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-end gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Keep Subscription
            </Button>
            <LoadingButton onClick={handleConfirmCancel} loading={isCanceling}>
              Cancel Subscription
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription Details Dialog */}
      {selectedSubscription && (
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Subscription Details</DialogTitle>
              <DialogDescription>
                Details about your subscription to this creator
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex items-center gap-3 pt-2 pb-4">
              <UserAvatar 
                avatarUrl={selectedSubscription.tier.creator.avatarUrl}
                className="h-10 w-10"
              />
              <div>
                <h3 className="font-medium text-base">{selectedSubscription.tier.creator.displayName}</h3>
                <p className="text-sm text-muted-foreground">@{selectedSubscription.tier.creator.username}</p>
              </div>
              {selectedSubscription.autoRenew ? (
                <Badge variant="outline" className="ml-auto bg-green-50 text-green-700 hover:bg-green-50 dark:bg-green-950/30 dark:text-green-400 border-green-200 dark:border-green-800">
                  Auto-Renew
                </Badge>
              ) : (
                <Badge variant="outline" className="ml-auto bg-amber-50 text-amber-700 hover:bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                  Expires Soon
                </Badge>
              )}
            </div>
            
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-[24px_1fr] gap-2 items-center">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium mb-0.5">Subscription Tier</p>
                  <p className="text-base">{selectedSubscription.tier.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-[24px_1fr] gap-2 items-center">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium mb-0.5">Price</p>
                  <p className="text-base">{formatCurrency(selectedSubscription.tier.price)}</p>
                </div>
              </div>

              <div className="grid grid-cols-[24px_1fr] gap-2 items-center">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium mb-0.5">Expiration Date</p>
                  <p className="text-base">{format(new Date(selectedSubscription.expiresAt), "PPP")}</p>
                </div>
              </div>

              <div className="grid grid-cols-[24px_1fr] gap-2 items-center">
                <RefreshCw className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium mb-0.5">Renewal Status</p>
                  <p className="text-base">{selectedSubscription.autoRenew ? "Auto-Renewal Enabled" : "Will Not Renew"}</p>
                </div>
              </div>

              <div className="grid grid-cols-[24px_1fr] gap-2 items-center">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium mb-0.5">Subscribed Since</p>
                  <p className="text-base">{format(new Date(selectedSubscription.createdAt), "PPP")}</p>
                </div>
              </div>
            </div>
            
            <DialogFooter className="flex flex-row justify-end gap-2 sm:gap-0">
              <Link href={`/users/${selectedSubscription.tier.creator.username}`} passHref>
                <Button variant="outline">
                  View Creator Profile
                  <ExternalLink className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
              <Button 
                variant={selectedSubscription.autoRenew ? "default" : "secondary"}
                onClick={() => {
                  setShowDetailsDialog(false);
                  handleCancelClick(selectedSubscription.id);
                }}
              >
                {selectedSubscription.autoRenew ? "Cancel Subscription" : "Manage"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 