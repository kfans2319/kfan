"use client";

import MetaMaskTester from "@/components/MetaMaskTester";

export default function MetaMaskTestPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6 text-center">MetaMask Testing Page</h1>
      <MetaMaskTester />
      
      <div className="mt-8 max-w-md mx-auto">
        <h2 className="text-xl font-bold mb-2">Testnet ETH Faucets</h2>
        <p className="mb-4">Use these faucets to get testnet ETH for testing:</p>
        
        <ul className="list-disc list-inside space-y-2">
          <li>
            <a 
              href="https://sepoliafaucet.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Sepolia Testnet Faucet
            </a>
          </li>
          <li>
            <a 
              href="https://goerlifaucet.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Goerli Testnet Faucet
            </a>
          </li>
          <li>
            <a 
              href="https://mumbaifaucet.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Mumbai Testnet Faucet (Polygon)
            </a>
          </li>
        </ul>
        
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-sm">
          <p className="font-medium">Important Testing Notes:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Never use real ETH for testing</li>
            <li>Transaction values are kept small to minimize testnet ETH usage</li>
            <li>Always verify you're on a testnet before sending any transaction</li>
            <li>The recipient address is a test address and does not need to be changed</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
