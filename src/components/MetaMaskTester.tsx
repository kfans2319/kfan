"use client";

import { useState, useEffect } from "react";
import { connectWallet, getCurrentNetwork, checkWalletBalance, makePayment, ETHEREUM_NETWORKS } from "@/lib/metamask";
import { ETHEREUM_RECIPIENT_ADDRESS, getExplorerUrl } from "@/lib/paymentConfig";
import { AlertTriangle } from "lucide-react";

// Use centralized config for recipient address
const TEST_RECIPIENT = ETHEREUM_RECIPIENT_ADDRESS;
const TEST_AMOUNTS = ["0.0001", "0.001", "0.01"]; // Small test amounts in ETH

export default function MetaMaskTester() {
  const [walletStatus, setWalletStatus] = useState<string>("Not connected");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [networkInfo, setNetworkInfo] = useState<{name: string, chainId: number, isMainnet: boolean} | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedAmount, setSelectedAmount] = useState<string>(TEST_AMOUNTS[0]);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Connect to MetaMask
  const connect = async () => {
    setLoading(true);
    setError(null);
    try {
      const signer = await connectWallet();
      setWalletAddress(await signer.getAddress());
      setWalletStatus("Connected");
      
      // Check network
      const network = await getCurrentNetwork();
      setNetworkInfo(network);
      
      // Check for valid testnet - we only want to test on testnets
      if (!network) {
        setError("Unable to detect network");
      } else if (network.isMainnet) {
        setError(`WARNING: You are connected to Ethereum Mainnet. For testing, please use a testnet instead: ${ETHEREUM_NETWORKS.TESTNETS.map(t => t.name).join(', ')}`);
      } else {
        const isKnownTestnet = ETHEREUM_NETWORKS.TESTNETS.some(t => t.chainId === network.chainId);
        if (!isKnownTestnet) {
          setError(`You are on an unknown network. Please switch to a supported testnet: ${ETHEREUM_NETWORKS.TESTNETS.map(t => t.name).join(', ')}`);
        } else {
          setError(null);
        }
      }
    } catch (err) {
      console.error("Connection error:", err);
      setError(err instanceof Error ? err.message : "Failed to connect to wallet");
      setWalletStatus("Connection Failed");
    } finally {
      setLoading(false);
    }
  };

  // Check wallet balance
  const checkBalance = async () => {
    if (!walletAddress) return;
    
    setLoading(true);
    setError(null);
    try {
      const balanceCheck = await checkWalletBalance(selectedAmount);
      if (balanceCheck.hasBalance) {
        setBalance(`Sufficient balance for ${selectedAmount} ETH transaction`);
        setError(null);
      } else {
        setBalance("Insufficient balance");
        setError(balanceCheck.error);
      }
    } catch (err) {
      console.error("Balance check error:", err);
      setError(err instanceof Error ? err.message : "Failed to check balance");
    } finally {
      setLoading(false);
    }
  };

  // Make a test payment
  const testPayment = async () => {
    setLoading(true);
    setError(null);
    setTxHash(null);
    
    try {
      // Check network
      const network = await getCurrentNetwork();
      
      // Only allow payments on known testnets
      if (!network) {
        throw new Error("Unable to detect network");
      } else if (network.isMainnet) {
        throw new Error(`WARNING: You are connected to Ethereum Mainnet. This test component should only be used with testnets to avoid spending real ETH.`);
      }
      
      const isKnownTestnet = ETHEREUM_NETWORKS.TESTNETS.some(t => t.chainId === network.chainId);
      if (!isKnownTestnet) {
        throw new Error(`Please switch to a supported testnet: ${ETHEREUM_NETWORKS.TESTNETS.map(t => t.name).join(', ')}`);
      }
      
      // Check balance
      const balanceCheck = await checkWalletBalance(selectedAmount);
      if (!balanceCheck.hasBalance) {
        throw new Error(balanceCheck.error || "Insufficient funds for this transaction");
      }
      
      // Log the recipient address to verify it's correct
      console.log("Using recipient address:", TEST_RECIPIENT);
      
      // Make the payment
      const hash = await makePayment(selectedAmount, TEST_RECIPIENT);
      setTxHash(hash);
      
      // Update status
      setWalletStatus("Payment Successful");
    } catch (err) {
      console.error("Payment error:", err);
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  // Check if we're on mainnet
  const isMainnetNetwork = networkInfo ? networkInfo.isMainnet : false;

  return (
    <div className="max-w-md mx-auto border rounded-lg p-6 bg-white dark:bg-gray-800 shadow-md">
      <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-6 dark:bg-amber-900/20 dark:border-amber-700">
        <div className="flex gap-2 items-start">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-amber-800 dark:text-amber-300 text-sm mb-1">Development Testing Only</h3>
            <p className="text-amber-700 dark:text-amber-400 text-xs">
              This component is for development and testing purposes only. Please use testnet networks and never Ethereum Mainnet with this test tool.
            </p>
          </div>
        </div>
      </div>
      
      <h2 className="text-xl font-semibold mb-4">MetaMask Test Tool</h2>
      
      <div className="mb-4 flex flex-col space-y-1">
        <p className="text-sm font-medium">Status: <span className="font-normal">{walletStatus}</span></p>
        {walletAddress && (
          <p className="text-sm font-medium">
            Address: <span className="font-normal text-xs">{walletAddress}</span>
          </p>
        )}
        {networkInfo && (
          <p className="text-sm font-medium">
            Network: <span className={`font-normal ${networkInfo.isMainnet ? 'text-red-500' : ''}`}>
              {networkInfo.name} (Chain ID: {networkInfo.chainId})
              {networkInfo.isMainnet && ' - WARNING: MAINNET'}
            </span>
          </p>
        )}
        {balance && (
          <p className="text-sm font-medium">Balance Check: <span className="font-normal">{balance}</span></p>
        )}
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      
      {txHash && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded dark:bg-green-900/20 dark:border-green-700">
          <p className="font-medium text-sm text-green-700 dark:text-green-300 mb-1">Transaction Successful!</p>
          <p className="text-xs text-green-600 dark:text-green-400 mb-2 break-all">{txHash}</p>
          {networkInfo && (
            <a 
              href={getExplorerUrl(txHash, networkInfo.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              View on Block Explorer
            </a>
          )}
        </div>
      )}
      
      <div className="flex flex-col space-y-3">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium mb-1">Test Amount (ETH)</label>
          <select
            id="amount"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={selectedAmount}
            onChange={(e) => setSelectedAmount(e.target.value)}
          >
            {TEST_AMOUNTS.map(amount => (
              <option key={amount} value={amount}>{amount} ETH</option>
            ))}
          </select>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={connect}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex-1"
          >
            {loading ? "Working..." : "Connect Wallet"}
          </button>
          
          <button
            onClick={checkBalance}
            disabled={!walletAddress || loading}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 flex-1"
          >
            Check Balance
          </button>
        </div>
        
        <button
          onClick={testPayment}
          disabled={!walletAddress || loading || isMainnetNetwork}
          className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "Processing..." : "Send Test Transaction"}
        </button>
        
        {isMainnetNetwork && (
          <p className="text-xs text-red-600 font-medium text-center">
            Disabled: Test transactions not allowed on Mainnet
          </p>
        )}
      </div>
    </div>
  );
}
