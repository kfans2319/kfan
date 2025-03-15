"use client";

import { useSession } from "@/app/(main)/SessionProvider";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { makePayment, checkIfMainnet, getCurrentNetwork, ETHEREUM_NETWORKS, connectWallet } from "@/lib/metamask";
import { toast } from "@/components/ui/use-toast";
import { ETHEREUM_RECIPIENT_ADDRESS, USD_TO_ETH_RATE, getExplorerUrl } from "@/lib/paymentConfig";
import { AlertTriangle, RefreshCw, Wallet } from "lucide-react";

// Use centralized config for recipient address
const RECIPIENT_ADDRESS = ETHEREUM_RECIPIENT_ADDRESS;

const BALANCE_OPTIONS = [
  { amount: 10, label: "$10 Wallet Balance" },
  { amount: 25, label: "$25 Wallet Balance" },
  { amount: 50, label: "$50 Wallet Balance" },
  { amount: 100, label: "$100 Wallet Balance" },
  { amount: 500, label: "$500 Wallet Balance" },
];

// ETH conversion rate from centralized config
const USD_TO_ETH = USD_TO_ETH_RATE;

const PAYMENT_METHODS = [
  { id: "card", label: "Credit Card" },
  { id: "metamask", label: "MetaMask (ETH)" },
];

type CheckoutResponse = {
  url: string;
  error?: string;
};

// Helper to truncate wallet address for display
function truncateAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function BalanceMenu({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [networkInfo, setNetworkInfo] = useState<{name: string, chainId: number, isMainnet: boolean} | null>(null);
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isConnectingFirst, setIsConnectingFirst] = useState(false);
  
  // Reference to the menu element for detecting outside clicks
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle clicks outside of the menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    // Add event listener
    document.addEventListener("mousedown", handleClickOutside);
    
    // Clean up the event listener
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Check network when MetaMask payment is selected
  useEffect(() => {
    if (selectedPaymentMethod === "metamask") {
      const checkNetwork = async () => {
        setIsCheckingNetwork(true);
        try {
          const network = await getCurrentNetwork();
          setNetworkInfo(network);
          
          // Get the connected wallet address
          try {
            const signer = await connectWallet();
            const address = await signer.getAddress();
            setWalletAddress(address);
            console.log("Connected to wallet:", address);
          } catch (walletError) {
            console.error("Error getting wallet address:", walletError);
            setWalletAddress(null);
          }
          
          if (!network) {
            setError("Unable to detect network. Please make sure MetaMask is connected.");
          } else if (!network.isMainnet) {
            setError(`Please connect to Ethereum Mainnet to make payments. Current network: ${network.name}`);
          } else {
            setError(null);
          }
        } catch (err) {
          console.error("Error checking network:", err);
          setError("Failed to check network. Please ensure MetaMask is installed and unlocked.");
        } finally {
          setIsCheckingNetwork(false);
        }
      };
      
      checkNetwork();
    }
  }, [selectedPaymentMethod, isReconnecting]);

  // Pre-check balance when amount is selected (for MetaMask)
  useEffect(() => {
    if (selectedPaymentMethod === "metamask" && selectedAmount && networkInfo?.isMainnet) {
      const validateBalance = async () => {
        try {
          const ethAmount = (selectedAmount * USD_TO_ETH).toFixed(6);
          const { checkWalletBalance } = await import("@/lib/metamask");
          const balanceCheck = await checkWalletBalance(ethAmount);
          
          if (!balanceCheck.hasBalance) {
            setError(balanceCheck.error || "Insufficient funds for this transaction");
          } else {
            setError(null);
          }
        } catch (err) {
          console.error("Error validating balance:", err);
        }
      };
      
      validateBalance();
    }
  }, [selectedAmount, selectedPaymentMethod, networkInfo]);

  // Function to handle initial wallet connection
  const handleConnectWallet = async () => {
    setIsConnectingFirst(true);
    setError(null);
    
    try {
      const signer = await connectWallet();
      const address = await signer.getAddress();
      setWalletAddress(address);
      
      toast({
        title: "Wallet Connected",
        description: `Connected to ${truncateAddress(address)}`,
      });
      
      // Refresh network info
      const network = await getCurrentNetwork();
      setNetworkInfo(network);
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setError(error instanceof Error ? error.message : "Failed to connect wallet");
    } finally {
      setIsConnectingFirst(false);
    }
  };

  // Function to handle wallet reconnection
  const handleReconnectWallet = async () => {
    setIsReconnecting(true);
    setError(null);
    
    try {
      // Request accounts will trigger MetaMask's account selection UI
      if (typeof window !== 'undefined' && window.ethereum) {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
        
        // After permission request, refresh connection
        const signer = await connectWallet();
        const address = await signer.getAddress();
        setWalletAddress(address);
        
        toast({
          title: "Wallet Reconnected",
          description: `Connected to ${truncateAddress(address)}`,
        });
      }
    } catch (error) {
      console.error("Error reconnecting wallet:", error);
      setError(error instanceof Error ? error.message : "Failed to reconnect wallet");
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleConfirmation = () => {
    // Show confirmation dialog for real ETH payments
    if (selectedPaymentMethod === "metamask" && networkInfo?.isMainnet) {
      setShowConfirmation(true);
    } else {
      addBalance();
    }
  };

  const addBalance = async () => {
    if (!selectedAmount || !selectedPaymentMethod) return;
    
    setShowConfirmation(false);
    setError(null);
    setIsLoading(true);
    
    try {
      if (selectedPaymentMethod === "card") {
        const response = await fetch("/api/stripe/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: selectedAmount }),
        });
        
        const data = await response.json() as CheckoutResponse;
        
        if (!response.ok || !data.url) {
          throw new Error(data.error || "Failed to create checkout session");
        }
        
        window.location.href = data.url;
      } else if (selectedPaymentMethod === "metamask") {
        // Check if MetaMask is installed
        if (typeof window === 'undefined' || typeof window.ethereum === 'undefined') {
          setError('MetaMask is not installed. Please install MetaMask extension and refresh the page.');
          setIsLoading(false);
          return;
        }

        try {
          // Check if user is on mainnet
          const network = await getCurrentNetwork();
          if (!network?.isMainnet) {
            setError(`Please connect to Ethereum Mainnet to make payments. Current network: ${network?.name || "Unknown"}`);
            setIsLoading(false);
            return;
          }
          
          // Convert USD amount to ETH for the transaction
          const ethAmount = (selectedAmount * USD_TO_ETH).toFixed(6);
          console.log(`Converting $${selectedAmount} USD to ${ethAmount} ETH on ${network.name}`);
          
          // Pre-check wallet balance before attempting transaction
          const { checkWalletBalance } = await import("@/lib/metamask");
          const balanceCheck = await checkWalletBalance(ethAmount);
          if (!balanceCheck.hasBalance) {
            throw new Error(balanceCheck.error || "Insufficient funds for this transaction");
          }
          
          // Show toast notification that transaction is starting
          toast({
            title: "MetaMask Transaction",
            description: `Please approve the transaction in your MetaMask wallet for ${ethAmount} ETH`,
          });
          
          // Log the recipient address for debugging
          console.log("Using recipient address:", RECIPIENT_ADDRESS);
          
          // Attempt to make the payment using MetaMask
          const txHash = await makePayment(ethAmount, RECIPIENT_ADDRESS);
          
          if (!txHash) {
            throw new Error("Transaction failed - no transaction hash returned");
          }
          
          console.log(`Transaction successful! Hash: ${txHash}`);
          
          // If successful, update the user's balance on the server
          const updateResponse = await fetch("/api/balance/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              amount: selectedAmount,
              transactionHash: txHash,
              network: network.name
            }),
          });
          
          if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            throw new Error(errorData.error || "Failed to update balance");
          }
          
          toast({
            title: "Payment Successful",
            description: (
              <div className="flex flex-col gap-1">
                <p>Added ${selectedAmount} to your balance</p>
                <a 
                  href={getExplorerUrl(txHash, network.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 underline text-sm"
                >
                  View transaction on Etherscan
                </a>
              </div>
            ),
          });
          
          router.refresh();
          onClose();
        } catch (metamaskError) {
          console.error("MetaMask payment error:", metamaskError);
          if (metamaskError instanceof Error) {
            // Handle specific error messages
            setError(metamaskError.message);
          } else {
            setError('An unknown error occurred while connecting to MetaMask. Please try again.');
          }
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error("Error processing payment:", error instanceof Error ? error.message : "Unknown error");
      setError(error instanceof Error ? error.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={menuRef} className="absolute right-0 top-full mt-2 w-80 rounded-lg bg-card shadow-lg">
      <div className="p-4 space-y-4">
        <div>
          <label htmlFor="balance-option" className="block text-sm font-medium mb-1">
            Select Amount
          </label>
          <select
            id="balance-option"
            className="w-full rounded-md border-input bg-background px-3 py-2 text-sm"
            value={selectedAmount ?? ""}
            onChange={(e) => setSelectedAmount(Number(e.target.value))}
          >
            <option value="" disabled>Choose an amount</option>
            {BALANCE_OPTIONS.map((option) => (
              <option key={option.amount} value={option.amount}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="payment-method" className="block text-sm font-medium mb-1">
            Payment Method  
          </label>
          <select
            id="payment-method"
            className="w-full rounded-md border-input bg-background px-3 py-2 text-sm"
            value={selectedPaymentMethod ?? ""}
            onChange={(e) => setSelectedPaymentMethod(e.target.value)}
          >
            <option value="" disabled>Choose a payment method</option>
            {PAYMENT_METHODS.map((method) => (
              <option key={method.id} value={method.id}>
                {method.label}
              </option>
            ))}
          </select>
        </div>

        {selectedPaymentMethod === "metamask" && (
          <div className="space-y-2">
            <div className="flex flex-col gap-2">
              <div className="bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Wallet size={16} className="text-primary" />
                    <span className="text-sm font-medium">Wallet Connection</span>
                  </div>
                  
                  {isCheckingNetwork && (
                    <span className="text-xs text-muted-foreground">Checking...</span>
                  )}
                </div>
                
                {walletAddress ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      {truncateAddress(walletAddress)}
                    </span>
                    <button
                      onClick={handleReconnectWallet}
                      disabled={isReconnecting}
                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw size={12} className={isReconnecting ? "animate-spin" : ""} />
                      {isReconnecting ? "Connecting..." : "Switch Wallet"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleConnectWallet}
                    disabled={isConnectingFirst}
                    className="w-full text-xs px-3 py-1.5 bg-primary/90 hover:bg-primary text-white rounded flex items-center justify-center gap-1.5"
                  >
                    <Wallet size={14} />
                    {isConnectingFirst ? "Connecting..." : "Connect Wallet"}
                  </button>
                )}
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              You will be charged approximately {selectedAmount ? (selectedAmount * USD_TO_ETH).toFixed(6) : '0'} ETH
            </p>
            
            {isCheckingNetwork ? (
              <p className="text-xs text-muted-foreground">Checking network connection...</p>
            ) : networkInfo?.isMainnet ? (
              <p className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 p-2 rounded">
                Connected to Ethereum Mainnet. Ready for payment with real ETH.
              </p>
            ) : (
              <p className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100 p-2 rounded">
                Please connect to Ethereum Mainnet. Current network: {networkInfo?.name || "Unknown"}
              </p>
            )}
            
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded p-2 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-amber-800 dark:text-amber-200">
                  You are making a payment with <strong>real ETH</strong> on the Ethereum Mainnet. This transaction is irreversible.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 p-2 border border-red-200 rounded bg-red-50 dark:bg-red-900/20 dark:border-red-800">
            {error}
          </p>
        )}

        {showConfirmation ? (
          <div className="space-y-3">
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded p-3 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">Confirm Payment</p>
              <p className="text-amber-700 dark:text-amber-300 text-xs mb-2">
                You are about to pay <strong>{selectedAmount ? (selectedAmount * USD_TO_ETH).toFixed(6) : '0'} ETH</strong> (approximately ${selectedAmount}) using real ETH on Ethereum Mainnet.
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                This transaction will be irreversible once confirmed.
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmation(false)}
                disabled={isLoading}
                className="px-3 py-2 rounded-md border border-input bg-background text-sm font-medium flex-1"
              >
                Cancel
              </button>
              
              <button
                onClick={addBalance}
                disabled={isLoading || !!error}
                className="px-3 py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium flex-1 disabled:opacity-50"
              >
                {isLoading ? "Processing..." : "Confirm Payment"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleConfirmation}
            disabled={isLoading || !selectedAmount || !selectedPaymentMethod || !!error || (selectedPaymentMethod === "metamask" && !walletAddress)}
            className="w-full px-3 py-2 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {isLoading ? "Processing..." : "Add to Balance"}
          </button>
        )}
        
        <button
          onClick={onClose}
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}