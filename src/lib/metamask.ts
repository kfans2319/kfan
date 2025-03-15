import { ethers } from 'ethers';

declare global {
  interface Window {
    ethereum: any;
  }
}

// Ethereum network configurations
export const ETHEREUM_NETWORKS = {
  MAINNET: { name: 'Ethereum', chainId: 1 },
  // Keep testnets for development reference but they won't be used in production
  TESTNETS: [
    { name: 'Sepolia', chainId: 11155111 },
    { name: 'Goerli', chainId: 5 },
    { name: 'Mumbai', chainId: 80001 }
  ]
};

// Legacy export for backward compatibility during transition
export const SUPPORTED_TESTNETS = ETHEREUM_NETWORKS.TESTNETS;

/**
 * Connects to the user's MetaMask wallet
 * @param retryCount Number of retries attempted (used internally)
 * @returns The signer object if successful, null otherwise
 */
export async function connectWallet(retryCount = 0) {
  // Check if MetaMask is installed
  if (typeof window === 'undefined') {
    throw new Error('Cannot connect to MetaMask in a server environment');
  }
  
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask not installed');
  }
  
  try {
    console.log('Requesting MetaMask accounts...');
    // Request access to the user's MetaMask accounts
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    console.log('Creating browser provider...');
    // In ethers v6, we use BrowserProvider instead of Web3Provider
    const provider = new ethers.BrowserProvider(window.ethereum);
    
    console.log('Getting signer...');
    const signer = await provider.getSigner();
    console.log('MetaMask connected successfully:', await signer.getAddress());
    return signer;
  } catch (error) {
    console.error('Error connecting to MetaMask:', error);
    
    // Provide more specific error messages based on the error
    if (error instanceof Error) {
      if (error.message.includes('Already processing eth_requestAccounts')) {
        // If we've already tried a few times, give up
        if (retryCount >= 2) {
          throw new Error('MetaMask connection failed after multiple attempts. Please refresh the page and try again.');
        }
        
        // Wait a moment and try again
        console.log('MetaMask is busy, waiting to retry...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return connectWallet(retryCount + 1);
      } else if (error.message.includes('user rejected')) {
        throw new Error('MetaMask connection rejected by user');
      } else if ('code' in error && error.code === 4001) {
        throw new Error('MetaMask connection rejected by user');  
      } else if (error.message.includes('network') || error.message.includes('connect') || error.message.includes('request')) {
        // Network or connection issues
        if (retryCount >= 2) {
          throw new Error('Network error while connecting to MetaMask. Please check your internet connection and try again.');
        }
        
        console.log('Network issue detected, waiting to retry...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return connectWallet(retryCount + 1);
      }
    }
    
    // If we've reached the maximum number of retries, throw a general error
    if (retryCount >= 2) {
      throw new Error('An unknown error occurred while connecting to MetaMask. Please refresh the page and try again.');
    }
    
    // Otherwise, try again after a brief delay
    console.log('Unknown error, waiting to retry...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    return connectWallet(retryCount + 1);
  }
}

/**
 * Checks if the user is connected to Ethereum mainnet
 * @returns true if connected to mainnet, false otherwise
 */
export async function checkIfMainnet() {
  try {
    const signer = await connectWallet();
    const network = await signer.provider.getNetwork();
    
    // Check if connected to Ethereum mainnet (chainId 1)
    return network.chainId === BigInt(ETHEREUM_NETWORKS.MAINNET.chainId);
  } catch (error) {
    console.error('Error checking network:', error);
    return false;
  }
}

/**
 * Gets the current network information
 * @returns An object containing network name and chainId, or null if error
 */
export async function getCurrentNetwork() {
  try {
    const signer = await connectWallet();
    const network = await signer.provider.getNetwork();
    const chainId = Number(network.chainId);
    
    if (chainId === ETHEREUM_NETWORKS.MAINNET.chainId) {
      return { name: ETHEREUM_NETWORKS.MAINNET.name, chainId, isMainnet: true };
    }
    
    // Check if on a known testnet
    for (const testnet of ETHEREUM_NETWORKS.TESTNETS) {
      if (chainId === testnet.chainId) {
        return { name: testnet.name, chainId, isMainnet: false };
      }
    }
    
    // Unknown network
    return { name: network.name || 'Unknown Network', chainId, isMainnet: false };
  } catch (error) {
    console.error('Error getting current network:', error);
    return null;
  }
}

/**
 * Legacy function for backward compatibility
 * Checks if the user is connected to a testnet
 * @returns The name of the testnet if connected to one, false otherwise
 * @deprecated Use getCurrentNetwork() instead for more comprehensive network info
 */
export async function checkIfTestnet() {
  try {
    const signer = await connectWallet();
    const network = await signer.provider.getNetwork();
    
    for (const testnet of ETHEREUM_NETWORKS.TESTNETS) {
      if (network.chainId === BigInt(testnet.chainId)) {
        return testnet.name;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking network:', error);
    return false;
  }
}

/**
 * Checks if the user's wallet has sufficient balance for a transaction
 * @param amount The amount to send in ETH
 * @returns Object containing hasBalance boolean and any error message
 */
export async function checkWalletBalance(amount: string) {
  try {
    const signer = await connectWallet();
    const address = await signer.getAddress();
    const balance = await signer.provider.getBalance(address);
    const requiredWei = ethers.parseEther(amount);
    
    // Estimate gas cost for a basic transaction (roughly 21000 gas units)
    // On mainnet, gas costs are higher, so we'll use a more conservative estimate
    const gasPrice = await signer.provider.getFeeData();
    const estimatedGasCost = gasPrice.gasPrice ? BigInt(30000) * gasPrice.gasPrice : BigInt(0);
    
    const totalRequired = requiredWei + estimatedGasCost;
    
    console.log(`Wallet balance: ${ethers.formatEther(balance)} ETH`);
    console.log(`Required for transaction: ${ethers.formatEther(totalRequired)} ETH (including gas)`);
    
    if (balance < totalRequired) {
      const shortfall = ethers.formatEther(totalRequired - balance);
      return {
        hasBalance: false,
        error: `Insufficient funds. You need approximately ${shortfall} more ETH for this transaction.`
      };
    }
    
    return { hasBalance: true, error: null };
  } catch (error) {
    console.error('Error checking wallet balance:', error);
    return { 
      hasBalance: false, 
      error: error instanceof Error ? error.message : 'Unknown error checking balance'
    };
  }
}

/**
 * Makes a payment using MetaMask
 * @param amount The amount to send in ETH
 * @param recipient The recipient Ethereum address
 * @returns The transaction hash if successful
 */
export async function makePayment(amount: string, recipient: string) {
  try {
    console.log(`Initiating payment of ${amount} ETH to ${recipient}`);
    
    // Validate the recipient address
    if (!recipient || !ethers.isAddress(recipient)) {
      console.error('Invalid Ethereum address provided:', recipient);
      throw new Error('Please provide a valid Ethereum address');
    }
    
    // Validate amount
    if (!amount || isNaN(parseFloat(amount))) {
      throw new Error('Please provide a valid amount');
    }
    
    const signer = await connectWallet();
    if (!signer) {
      throw new Error('Failed to connect to MetaMask');
    }
    
    // Get the current network
    const network = await getCurrentNetwork();
    console.log('Connected to network:', network?.name, 'Chain ID:', network?.chainId);
    
    // Check if wallet has sufficient balance before attempting transaction
    const balanceCheck = await checkWalletBalance(amount);
    if (!balanceCheck.hasBalance) {
      throw new Error(balanceCheck.error || 'Insufficient funds in your wallet');
    }
    
    console.log('Creating transaction...');
    const tx = await signer.sendTransaction({
      to: recipient,
      // In ethers v6, parseEther is a top-level function
      value: ethers.parseEther(amount),
    });
    
    console.log('Transaction sent:', tx.hash);
    console.log('Waiting for confirmation...');
    
    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt);
    
    return tx.hash;
  } catch (error) {
    console.error('Error making payment with MetaMask:', error);
    
    // Provide more specific error messages based on the error
    if (error instanceof Error) {
      if (error.message.includes('insufficient funds')) {
        throw new Error('Insufficient funds in your wallet to complete this transaction. Please add more ETH to your wallet.');
      } else if (error.message.includes('user rejected')) {
        throw new Error('Transaction was rejected by the user');
      } else if (error.message.includes('network error') || error.message.includes('disconnected')) {
        throw new Error('Network error during transaction. Please check your internet connection and try again');
      } else if (error.message.includes('valid') && error.message.includes('address')) {
        throw new Error('Please provide a valid Ethereum address');
      }
      throw error;
    }
    
    throw new Error('Failed to process payment through MetaMask');
  }
}