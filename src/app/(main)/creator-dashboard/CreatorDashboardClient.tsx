"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, CreditCard, TrendingUp, ExternalLink, BadgeCheck, Clock, BarChart, Landmark, ChevronUp, ChevronDown, Home, PieChart } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import BankInformationForm from "./BankInformationForm";
import EarningsHistory from "./EarningsHistory";
import PayoutRequestForm from "./PayoutRequestForm";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import PayoutHistory from "./PayoutHistory";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

interface CreatorDashboardClientProps {
  userId: string;
  username: string;
  balance: string;
  earningsBalance: string;
  hasTiers: boolean;
  tiers?: {
    id: string;
    name: string;
    price: string;
    duration: number;
  }[];
}

export default function CreatorDashboardClient({
  userId,
  username,
  balance,
  earningsBalance,
  hasTiers,
  tiers = [],
}: CreatorDashboardClientProps) {
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(max-width: 1024px)");
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedStatCard, setExpandedStatCard] = useState<string | null>(null);
  const balanceNum = parseFloat(balance);
  const earningsBalanceNum = parseFloat(earningsBalance);
  
  // Fetch bank information
  const { data: bankInfo, isLoading: loadingBankInfo } = useQuery({
    queryKey: ["bankInformation", userId],
    queryFn: async () => {
      const response = await fetch(`/api/creator/bank-info`);
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No bank info yet
        }
        throw new Error("Failed to fetch bank information");
      }
      return response.json();
    },
  });

  // Fetch earnings stats
  const { data: earningsStats, isLoading: loadingStats } = useQuery({
    queryKey: ["creatorEarnings", "stats", userId],
    queryFn: async () => {
      const response = await fetch(`/api/creator/earnings/stats`);
      if (!response.ok) {
        throw new Error("Failed to fetch earnings statistics");
      }
      return response.json();
    },
  });

  // Fetch most recent payout request
  const { data: latestPayout, isLoading: loadingPayout } = useQuery({
    queryKey: ["payoutRequests", "latest", userId],
    queryFn: async () => {
      const response = await fetch(`/api/creator/payouts/latest`);
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No payouts yet
        }
        throw new Error("Failed to fetch latest payout");
      }
      return response.json();
    },
  });

  const loading = loadingBankInfo || loadingStats || loadingPayout;
  
  const stats = {
    totalEarnings: earningsStats?.totalEarnings || 0,
    subscriberCount: earningsStats?.subscriberCount || 0,
    recentEarnings: earningsStats?.last30DaysEarnings || 0,
    avgEarningPerSub: earningsStats?.avgEarningPerSubscriber || 0,
  };

  // Determine if user can request payout
  const canRequestPayout = bankInfo && earningsBalanceNum >= 100;
  
  // Where we define the platform fee percentage
  const PLATFORM_FEE_PERCENTAGE = 15;
  
  // Handle tier creation if user has no tiers
  const handleCreateTier = () => {
    router.push(`/users/${username}/edit-tiers`);
  };
  
  // Toggle expanded state of stat cards on mobile
  const toggleStatCardExpansion = (cardId: string) => {
    if (expandedStatCard === cardId) {
      setExpandedStatCard(null);
    } else {
      setExpandedStatCard(cardId);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-[1200px] mx-auto">
      {/* Show message if no subscription tiers */}
      {!hasTiers && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-amber-800 dark:text-amber-300">
                  Set up subscription tiers
                </h3>
                <p className="text-amber-700 dark:text-amber-400 mt-1 text-sm sm:text-base">
                  You need to create at least one subscription tier before you can receive earnings from subscribers. To create a subscription go to your profile page and click on edit profile.
                </p>
              </div>
             
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Overview Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Balance */}
        <Card className={cn(
          "overflow-hidden",
          expandedStatCard === "balance" && "bg-muted/5"
        )}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Creator Balance
            </CardTitle>
            {isMobile && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6" 
                onClick={() => toggleStatCardExpansion("balance")}
              >
                {expandedStatCard === "balance" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              {loading ? (
                <div className="h-7 w-16 animate-pulse rounded bg-muted"></div>
              ) : (
                formatCurrency(earningsBalanceNum)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              After 15% platform fee
            </p>
            
            {isMobile && expandedStatCard === "balance" && (
              <div className="mt-3 pt-3 border-t text-sm">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Platform Fee:</span>
                  <span className="font-medium">{PLATFORM_FEE_PERCENTAGE}%</span>
                </p>
                <p className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Payout Minimum:</span>
                  <span className="font-medium">{formatCurrency(100)}</span>
                </p>
                <p className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Available for Payout:</span>
                  <span className={cn(
                    "font-medium",
                    earningsBalanceNum >= 100 ? "text-green-600" : "text-amber-600"
                  )}>
                    {earningsBalanceNum >= 100 ? "Yes" : "No"}
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Active Subscribers */}
        <Card className={cn(
          "transition-all duration-200",
          isMobile && expandedStatCard === "subscribers" && "ring-2 ring-primary/20"
        )}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Subscribers
            </CardTitle>
            <div className="flex items-center">
              <Users className="h-4 w-4 text-muted-foreground" />
              {isMobile && (
                <Button
                  variant="ghost" 
                  size="sm"
                  className="h-6 w-6 p-0 ml-1" 
                  onClick={() => toggleStatCardExpansion("subscribers")}
                >
                  {expandedStatCard === "subscribers" ? 
                    <ChevronUp className="h-3 w-3" /> : 
                    <ChevronDown className="h-3 w-3" />
                  }
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              {loading ? (
                <div className="h-7 w-16 animate-pulse rounded bg-muted"></div>
              ) : (
                stats.subscriberCount
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg. value: {formatCurrency(stats.avgEarningPerSub)}/subscriber
            </p>
            
            {isMobile && expandedStatCard === "subscribers" && (
              <div className="mt-3 pt-3 border-t text-sm">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Current Trend:</span>
                  <span className="font-medium">
                    {stats.subscriberCount > 10 ? "Growing" : "Starting Out"}
                  </span>
                </p>
                <p className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Subscriber Value:</span>
                  <span className="font-medium">
                    {stats.avgEarningPerSub > 10 ? "High" : "Building"}
                  </span>
                </p>
                {hasTiers && (
                  <Button 
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => router.push(`/users/${username}/edit-tiers`)}
                  >
                    Manage Tiers
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Recent Earnings */}
        <Card className={cn(
          "transition-all duration-200",
          isMobile && expandedStatCard === "recentEarnings" && "ring-2 ring-primary/20"
        )}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              30-day Earnings
            </CardTitle>
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              {isMobile && (
                <Button
                  variant="ghost" 
                  size="sm"
                  className="h-6 w-6 p-0 ml-1" 
                  onClick={() => toggleStatCardExpansion("recentEarnings")}
                >
                  {expandedStatCard === "recentEarnings" ? 
                    <ChevronUp className="h-3 w-3" /> : 
                    <ChevronDown className="h-3 w-3" />
                  }
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              {loading ? (
                <div className="h-7 w-24 animate-pulse rounded bg-muted"></div>
              ) : (
                formatCurrency(stats.recentEarnings)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.recentEarnings > stats.totalEarnings * 0.1
                ? "↗ Growing steady"
                : "→ Stable earnings"}
            </p>
            
            {isMobile && expandedStatCard === "recentEarnings" && (
              <div className="mt-3 pt-3 border-t text-sm">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Growth:</span>
                  <span className="font-medium">
                    {stats.recentEarnings > 0 
                      ? `${Math.round((stats.recentEarnings/stats.totalEarnings) * 100)}%`
                      : "No data yet"}
                  </span>
                </p>
                <p className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Lifetime Total:</span>
                  <span className="font-medium">
                    {formatCurrency(stats.totalEarnings)}
                  </span>
                </p>
                <Button 
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setActiveTab("earnings")}
                >
                  View Earnings History
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Latest Payout */}
        <Card className={cn(
          "transition-all duration-200",
          isMobile && expandedStatCard === "latestPayout" && "ring-2 ring-primary/20"
        )}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Latest Payout
            </CardTitle>
            <div className="flex items-center">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              {isMobile && (
                <Button
                  variant="ghost" 
                  size="sm"
                  className="h-6 w-6 p-0 ml-1" 
                  onClick={() => toggleStatCardExpansion("latestPayout")}
                >
                  {expandedStatCard === "latestPayout" ? 
                    <ChevronUp className="h-3 w-3" /> : 
                    <ChevronDown className="h-3 w-3" />
                  }
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              {loading ? (
                <div className="h-7 w-24 animate-pulse rounded bg-muted"></div>
              ) : latestPayout ? (
                formatCurrency(latestPayout.amount)
              ) : (
                "No payouts yet"
              )}
            </div>
            {latestPayout ? (
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(latestPayout.requestedAt), { addSuffix: true })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Request your first payout when eligible
              </p>
            )}
            
            {isMobile && expandedStatCard === "latestPayout" && (
              <div className="mt-3 pt-3 border-t text-sm">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium">
                    {latestPayout 
                      ? latestPayout.status 
                      : "No requests yet"}
                  </span>
                </p>
                {latestPayout && (
                  <p className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Requested:</span>
                    <span className="font-medium">
                      {new Date(latestPayout.requestedAt).toLocaleDateString()}
                    </span>
                  </p>
                )}
                <Button 
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setActiveTab("payouts")}
                >
                  View All Payouts
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payout Eligibility Notice */}
      {earningsBalanceNum >= 100 && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <h3 className="text-base sm:text-lg font-medium text-green-800 dark:text-green-300">
                Eligible for Payout
              </h3>
            </div>
            <p className="text-green-700 dark:text-green-400 mt-1 mb-4 text-sm sm:text-base">
              You've reached the minimum balance threshold of $100 and are eligible for a payout request.
            </p>
            {!bankInfo && (
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                <p className="text-amber-700 dark:text-amber-400 text-sm sm:text-base">
                  You need to add your bank information before requesting a payout.
                </p>
                <Button 
                  variant="outline" 
                  className="sm:ml-auto w-full sm:w-auto"
                  onClick={() => setActiveTab("bank-info")}
                >
                  Add Bank Information
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Dashboard content with headers */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-4">
          <h2 className="text-lg sm:text-xl font-semibold">Creator Dashboard</h2>
          {hasTiers && (
            <div className="flex flex-wrap gap-2 sm:gap-4 text-sm">
             
              <Link 
                href={`/users/${username}`} 
                className="flex items-center gap-1 text-primary hover:underline"
              >
                View Your Profile <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
        
        {/* Dashboard Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full h-auto overflow-visible">
            <div className="grid grid-cols-4 w-full gap-2">
              <TabsTrigger 
                value="overview" 
                className={cn(
                  "py-2 px-2 h-auto rounded-md text-center",
                  isMobile ? "text-xs" : "text-sm"
                )}
              >
                {isMobile ? (
                  <div className="flex flex-col items-center space-y-1">
                    <Home className="h-4 w-4" />
                    <span>Overview</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Home className="h-4 w-4" />
                    <span>Overview</span>
                  </div>
                )}
              </TabsTrigger>
              
              <TabsTrigger 
                value="earnings" 
                className={cn(
                  "py-2 px-2 h-auto rounded-md text-center",
                  isMobile ? "text-xs" : "text-sm"
                )}
              >
                {isMobile ? (
                  <div className="flex flex-col items-center space-y-1">
                    <PieChart className="h-4 w-4" />
                    <span>Earnings</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <PieChart className="h-4 w-4" />
                    <span>Earnings</span>
                  </div>
                )}
              </TabsTrigger>
              
              <TabsTrigger 
                value="payouts" 
                className={cn(
                  "py-2 px-2 h-auto rounded-md text-center",
                  isMobile ? "text-xs" : "text-sm"
                )}
              >
                {isMobile ? (
                  <div className="flex flex-col items-center space-y-1">
                    <CreditCard className="h-4 w-4" />
                    <span>Payouts</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <CreditCard className="h-4 w-4" />
                    <span>Payouts</span>
                  </div>
                )}
              </TabsTrigger>
              
              <TabsTrigger 
                value="bank-info" 
                className={cn(
                  "py-2 px-2 h-auto rounded-md text-center",
                  isMobile ? "text-xs" : "text-sm"
                )}
              >
                {isMobile ? (
                  <div className="flex flex-col items-center space-y-1">
                    <Landmark className="h-4 w-4" />
                    <span>Banking</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Landmark className="h-4 w-4" />
                    <span>Banking</span>
                  </div>
                )}
              </TabsTrigger>
            </div>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4 mt-4 sm:mt-6">
            <Card>
              <CardHeader className="sm:border-b">
                <div className="flex items-center gap-2">
                  <BarChart className="h-5 w-5 text-primary hidden sm:block" />
                  <CardTitle className="text-lg sm:text-xl">Creator Overview</CardTitle>
                </div>
                <CardDescription className="text-sm sm:text-base">
                  Overview of your creator account, earnings, and payout options.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-6">
                <div>
                  <h3 className="text-base sm:text-lg font-medium mb-3">Account Summary</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium">Subscription Balance</h4>
                      </div>
                      <p className="text-lg font-semibold pl-6">{formatCurrency(balanceNum)}</p>
                      <p className="text-xs text-muted-foreground pl-6">For paying for subscriptions</p>
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium">Earnings Balance</h4>
                      </div>
                      <p className="text-lg font-semibold pl-6">{formatCurrency(earningsBalanceNum)}</p>
                      <p className="text-xs text-muted-foreground pl-6">Available for payout</p>
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium">Total Subscribers</h4>
                      </div>
                      <p className="text-lg font-semibold pl-6">{stats.subscriberCount}</p>
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <BarChart className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium">Lifetime Earnings</h4>
                      </div>
                      <p className="text-lg font-semibold pl-6">{formatCurrency(stats.totalEarnings)}</p>
                      <p className="text-xs text-muted-foreground pl-6">After {PLATFORM_FEE_PERCENTAGE}% platform fee</p>
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium">Bank Status</h4>
                      </div>
                      <p className="text-lg font-semibold pl-6">
                        {loading ? (
                          <span className="text-sm text-muted-foreground">Loading...</span>
                        ) : bankInfo ? (
                          <span className="text-sm text-green-600">Configured</span>
                        ) : (
                          <span className="text-sm text-amber-600">Not Configured</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-base sm:text-lg font-medium mb-3">Getting Started</h3>
                  <ul className="space-y-2 text-sm sm:text-base">
                    {!hasTiers && (
                      <li className="flex items-start gap-2">
                        <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                          <span className="block h-1.5 w-1.5 rounded-full bg-primary"></span>
                        </div>
                        <span>Create at least one subscription tier for your fans</span>
                      </li>
                    )}
                    {!bankInfo && (
                      <li className="flex items-start gap-2">
                        <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                          <span className="block h-1.5 w-1.5 rounded-full bg-primary"></span>
                        </div>
                        <span>Add your bank information to receive payouts</span>
                      </li>
                    )}
                    <li className="flex items-start gap-2">
                      <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                        <span className="block h-1.5 w-1.5 rounded-full bg-primary"></span>
                      </div>
                      <span>When you reach $100 in earnings, you can request a payout</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                        <span className="block h-1.5 w-1.5 rounded-full bg-primary"></span>
                      </div>
                      <span>Keep creating engaging content to increase your subscriber base</span>
                    </li>
                  </ul>
                </div>
                
                {canRequestPayout && (
                  <div className="pt-4 flex justify-center sm:justify-start">
                    <Button onClick={() => setActiveTab("payouts")} className="w-full sm:w-auto">
                      Request Payout
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="earnings" className="space-y-4 mt-4 sm:mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
              <h3 className="text-base sm:text-lg font-medium">Earnings History</h3>
              <p className="text-sm text-muted-foreground">
                Total earned: {formatCurrency(stats.totalEarnings)}
              </p>
            </div>
            <EarningsHistory userId={userId} />
          </TabsContent>
          
          <TabsContent value="payouts" className="space-y-4 mt-4 sm:mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
              <h3 className="text-base sm:text-lg font-medium">Payout Management</h3>
              <p className="text-sm text-muted-foreground">
                Available for payout: {formatCurrency(Math.max(0, earningsBalanceNum - 99))}
              </p>
            </div>
            
            {canRequestPayout && (
              <PayoutRequestForm userId={userId} availableAmount={earningsBalanceNum} />
            )}
            
            <div className="mt-6">
              <h3 className="text-base sm:text-lg font-medium mb-2">Payout History</h3>
              <PayoutHistory userId={userId} />
            </div>
          </TabsContent>
          
          <TabsContent value="bank-info" className="space-y-4 mt-4 sm:mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
              <h3 className="text-base sm:text-lg font-medium">Banking Information</h3>
              <p className="text-sm text-muted-foreground">
                {bankInfo ? "Last updated: " + new Date(bankInfo.updatedAt).toLocaleDateString() : "Not configured"}
              </p>
            </div>
            <BankInformationForm 
              userId={userId} 
              existingBankInfo={bankInfo} 
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 