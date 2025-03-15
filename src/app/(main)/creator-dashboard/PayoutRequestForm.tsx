"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { AlertCircle, CheckCircle, CreditCard, DollarSign, Landmark, Wallet } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { connectWallet } from "@/lib/metamask";
import { ethers } from "ethers";

interface PayoutRequestFormProps {
  userId: string;
  availableAmount: number;
}

export default function PayoutRequestForm({ userId, availableAmount }: PayoutRequestFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<string>("");
  const [payoutMethod, setPayoutMethod] = useState<"BANK" | "ETH_WALLET">("BANK");
  const [ethWalletAddress, setEthWalletAddress] = useState<string>("");
  const [isConnectingWallet, setIsConnectingWallet] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [bankInfo, setBankInfo] = useState<any>(null);
  
  const isValidAmount = amount && !isNaN(parseFloat(amount)) && parseFloat(amount) >= 100 && parseFloat(amount) <= availableAmount;
  const isValidEthAddress = payoutMethod === "BANK" || (ethWalletAddress && ethers.isAddress(ethWalletAddress));
  const canSubmit = isValidAmount && (payoutMethod === "BANK" || isValidEthAddress);
  
  // Connect MetaMask wallet to get ETH address
  const connectEthWallet = async () => {
    setIsConnectingWallet(true);
    setError(null);
    
    try {
      const signer = await connectWallet();
      const address = await signer.getAddress();
      setEthWalletAddress(address);
      toast({
        title: "Wallet Connected",
        description: `Connected to ${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
      });
    } catch (err) {
      console.error("Error connecting wallet:", err);
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
    } finally {
      setIsConnectingWallet(false);
    }
  };
  
  // Fetch user's bank information
  useEffect(() => {
    const fetchBankInfo = async () => {
      try {
        const response = await fetch("/api/creator/bank-info");
        if (response.ok) {
          const data = await response.json();
          setBankInfo(data);
        }
      } catch (err) {
        console.error("Failed to fetch bank information:", err);
      }
    };
    
    if (payoutMethod === "BANK") {
      fetchBankInfo();
    }
  }, [payoutMethod]);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidAmount) {
      setError("Please enter a valid amount between $100 and your available balance");
      return;
    }
    
    if (payoutMethod === "ETH_WALLET" && !isValidEthAddress) {
      setError("Please connect a valid Ethereum wallet");
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch("/api/creator/payouts/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          payoutMethod: payoutMethod,
          ethWalletAddress: payoutMethod === "ETH_WALLET" ? ethWalletAddress : undefined,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit payout request");
      }
      
      setSuccess(true);
      setAmount("");
      setEthWalletAddress("");
      
      // Invalidate relevant queries to refetch the latest data
      queryClient.invalidateQueries({ queryKey: ["payoutRequests"] });
      queryClient.invalidateQueries({ queryKey: ["payoutRequests", "latest"] });
      
      toast({
        title: "Payout Request Submitted",
        description: "Your payout request has been submitted successfully.",
      });
    } catch (err) {
      console.error("Error submitting payout request:", err);
      setError(err instanceof Error ? err.message : "Failed to submit payout request");
    } finally {
      setSubmitting(false);
    }
  };
  
  // Enhanced message about bank type based on bank information
  const getBankPayoutMessage = (bankType: string) => {
    if (bankType === "INTERNATIONAL") {
      return (
        <>
          <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">
            Payout will be sent to your registered international bank account
          </span>
        </>
      );
    }
    
    return (
      <>
        <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">
          Payout will be sent to your registered domestic bank account
        </span>
      </>
    );
  };
  
  return (
    <Card>
      <CardHeader className={isMobile ? "px-4 py-4" : undefined}>
        <CardTitle className="text-lg sm:text-xl">Request Payout</CardTitle>
        <CardDescription>
          Request to withdraw your earnings to your bank account or Ethereum wallet
        </CardDescription>
      </CardHeader>
      <CardContent className={isMobile ? "px-4 pb-4" : undefined}>
        {success ? (
          <div className="rounded-md border border-green-200 bg-green-50 p-4 dark:bg-green-900/20 dark:border-green-900">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-600 dark:text-green-400 h-5 w-5" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-300">Payout Request Submitted</p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                  Your payout request has been submitted successfully. You will be notified once it's processed.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-1">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-2 mb-2">
                <Label htmlFor="amount" className="text-sm font-medium">
                  Payout Amount
                </Label>
                <span className="text-sm text-muted-foreground">
                  Available: {formatCurrency(availableAmount)}
                </span>
              </div>
              
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  placeholder="Enter amount"
                  className="pl-9"
                  type="number"
                  step="0.01"
                  min="100"
                  max={availableAmount}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="payoutMethod" className="text-sm font-medium">
                Payout Method
              </Label>
              <RadioGroup 
                defaultValue="BANK"
                value={payoutMethod}
                onValueChange={(value) => setPayoutMethod(value as "BANK" | "ETH_WALLET")}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2 rounded-md border p-3">
                  <RadioGroupItem value="BANK" id="bank" />
                  <Label htmlFor="bank" className="flex items-center cursor-pointer">
                    <Landmark className="h-4 w-4 mr-2 text-muted-foreground" />
                    Bank Account
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-md border p-3">
                  <RadioGroupItem value="ETH_WALLET" id="eth_wallet" />
                  <Label htmlFor="eth_wallet" className="flex items-center cursor-pointer">
                    <Wallet className="h-4 w-4 mr-2 text-muted-foreground" />
                    Ethereum Wallet
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            {payoutMethod === "ETH_WALLET" && (
              <div className="space-y-2 pt-2">
                <Label htmlFor="ethWalletAddress" className="text-sm font-medium">
                  Ethereum Wallet Address
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="ethWalletAddress"
                    placeholder="0x..."
                    value={ethWalletAddress}
                    onChange={(e) => setEthWalletAddress(e.target.value)}
                    className={ethWalletAddress && !ethers.isAddress(ethWalletAddress) ? "border-red-300" : ""}
                    disabled={!!ethWalletAddress}
                  />
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={connectEthWallet}
                    disabled={isConnectingWallet || !!ethWalletAddress}
                  >
                    {isConnectingWallet ? "Connecting..." : ethWalletAddress ? "Connected" : "Connect Wallet"}
                  </Button>
                </div>
                {ethWalletAddress && !ethers.isAddress(ethWalletAddress) && (
                  <p className="text-sm text-red-500">Invalid Ethereum address format</p>
                )}
              </div>
            )}
            
            <div className="flex items-center gap-1 mt-1 text-sm">
              {payoutMethod === "BANK" ? (
                bankInfo ? (
                  getBankPayoutMessage(bankInfo.bankType)
                ) : (
                  <>
                    <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Payout will be sent to your registered bank account
                    </span>
                  </>
                )
              ) : (
                <>
                  <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Payout will be sent to your connected Ethereum wallet
                  </span>
                </>
              )}
            </div>
            
            {error && (
              <Alert variant="destructive" className="py-2 text-sm">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
              <div className="text-sm text-muted-foreground order-2 sm:order-1 text-center sm:text-left pt-2 sm:pt-0 w-full sm:w-auto">
                Minimum payout amount: $100
              </div>
              <Button 
                type="submit" 
                disabled={submitting || !canSubmit}
                className="w-full sm:w-auto order-1 sm:order-2 sm:ml-auto"
              >
                {submitting ? "Submitting..." : "Request Payout"}
              </Button>
            </div>
          </form>
        )}
        
        <div className="pt-4 mt-4 border-t text-sm">
          <h3 className="font-medium mb-2">Payout Information</h3>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                <span className="block h-1.5 w-1.5 rounded-full bg-primary"></span>
              </div>
              <span>Payouts require a minimum balance of $100</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                <span className="block h-1.5 w-1.5 rounded-full bg-primary"></span>
              </div>
              <span>Payouts are typically processed within 3-5 business days</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                <span className="block h-1.5 w-1.5 rounded-full bg-primary"></span>
              </div>
              <span>You can have only one pending payout request at a time</span>
            </li>
            {payoutMethod === "BANK" && bankInfo?.bankType === "INTERNATIONAL" && (
              <li className="flex items-start gap-2">
                <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                  <span className="block h-1.5 w-1.5 rounded-full bg-primary"></span>
                </div>
                <span>International bank transfers may take 5-7 business days and may incur additional fees</span>
              </li>
            )}
            {payoutMethod === "BANK" && !bankInfo && (
              <li className="flex items-start gap-2">
                <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                  <span className="block h-1.5 w-1.5 rounded-full bg-primary"></span>
                </div>
                <span>
                  <a 
                    href="/creator-dashboard?tab=bank-info" 
                    className="text-primary hover:underline"
                  >
                    Add your bank information
                  </a>{' '}
                  before requesting a payout
                </span>
              </li>
            )}
            {payoutMethod === "ETH_WALLET" && (
              <li className="flex items-start gap-2">
                <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                  <span className="block h-1.5 w-1.5 rounded-full bg-primary"></span>
                </div>
                <span>ETH wallet payouts typically process faster than bank transfers</span>
              </li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
} 