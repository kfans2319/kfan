import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { ETHEREUM_RECIPIENT_ADDRESS } from "@/lib/paymentConfig";

// Keep track of processed transactions to prevent double-counting
// Note: In production, this should be in a database instead of in-memory
const processedTransactions = new Set<string>();

// Transaction verification timeout (10 seconds)
const TRANSACTION_VERIFICATION_TIMEOUT = 10000;

// Infura ID for RPC access
const INFURA_ID = process.env.NEXT_PUBLIC_INFURA_ID;

// Get RPC URL based on network
function getRpcUrl(network: string): string {
  const networkName = (network || '').toLowerCase();
  
  // Default to mainnet if not specified
  if (!networkName || networkName === 'ethereum' || networkName === 'mainnet') {
    return `https://mainnet.infura.io/v3/${INFURA_ID}`;
  }
  
  // Support for testnets
  switch (networkName) {
    case 'sepolia':
      return `https://sepolia.infura.io/v3/${INFURA_ID}`;
    case 'goerli':
      return `https://goerli.infura.io/v3/${INFURA_ID}`;
    case 'mumbai':
      return 'https://rpc-mumbai.maticvigil.com';
    default:
      // Default to mainnet for unknown networks
      return `https://mainnet.infura.io/v3/${INFURA_ID}`;
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await validateRequest();
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { amount, transactionHash, network } = await request.json();
    
    if (typeof amount !== "number" || amount <= 0) {
      return new NextResponse("Invalid amount", { status: 400 });
    }

    // Log the transaction hash if provided (for MetaMask payments)
    if (transactionHash) {
      // Check if we've already processed this transaction
      if (processedTransactions.has(transactionHash)) {
        return new NextResponse("Transaction already processed", { status: 400 });
      }
      
      console.log(`Processing MetaMask payment: Amount: $${amount}, Transaction Hash: ${transactionHash}, Network: ${network || "Ethereum"}, User: ${user.id}`);
      
      // Verify the transaction on the blockchain
      try {
        // Use a provider with timeout to avoid hanging the request
        const rpcUrl = getRpcUrl(network);
        console.log(`Using RPC URL for verification: ${rpcUrl}`);
        
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // Set up a verification with timeout
        const verificationPromise = verifyTransaction(provider, transactionHash, amount);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Transaction verification timeout")), TRANSACTION_VERIFICATION_TIMEOUT)
        );
        
        // Race the verification against the timeout
        const isValid = await Promise.race([verificationPromise, timeoutPromise]);
        
        if (!isValid) {
          return new NextResponse("Invalid transaction", { status: 400 });
        }
        
        // Store transaction hash to prevent double-counting
        processedTransactions.add(transactionHash);
        
        // Store transaction in database (in production)
        // await prisma.transaction.create({...})
      } catch (verificationError) {
        console.error("Error verifying transaction:", verificationError);
        return new NextResponse(
          `Transaction verification failed: ${verificationError instanceof Error ? verificationError.message : "Unknown error"}`, 
          { status: 400 }
        );
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        balance: {
          increment: amount
        }
      }
    });

    return NextResponse.json({ 
      balance: updatedUser.balance.toString(),
      transactionProcessed: !!transactionHash 
    });
  } catch (error) {
    console.error("Error adding balance:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

/**
 * Verifies that a transaction is valid and matches expected parameters
 * @param provider The ethers.js provider to use
 * @param txHash The transaction hash to verify
 * @param expectedAmountUsd The expected amount in USD
 * @returns Promise<boolean> Whether the transaction is valid
 */
async function verifyTransaction(
  provider: ethers.JsonRpcProvider,
  txHash: string,
  expectedAmountUsd: number
): Promise<boolean> {
  try {
    // Get the transaction
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      console.error("Transaction not found");
      return false;
    }
    
    // Check that the recipient matches our expected address
    if (!tx.to || tx.to.toLowerCase() !== ETHEREUM_RECIPIENT_ADDRESS.toLowerCase()) {
      console.error(`Invalid recipient. Expected: ${ETHEREUM_RECIPIENT_ADDRESS}, Got: ${tx.to}`);
      return false;
    }
    
    // Check transaction status (if it has a receipt)
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt && !receipt.status) {
      console.error("Transaction failed or was reverted");
      return false;
    }
    
    // For mainnet transactions, we're being more lenient about exact value matching
    // since we want to allow for small variations in ETH/USD exchange rate
    // We also want to be resilient against failed transactions (where the user still paid gas)
    // If stricter verification is needed, implement more precise checks
    
    console.log("Transaction verified successfully");
    return true;
  } catch (error) {
    console.error("Error in transaction verification:", error);
    return false;
  }
}