import { BrowserProvider, JsonRpcSigner, formatEther, parseEther } from 'ethers';

// Define a more specific window type with ethereum property
declare global {
  interface Window {
    ethereum: any;
  }
}

export async function connectWallet(): Promise<JsonRpcSigner | null> {
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      // In ethers v6, we use BrowserProvider instead of Web3Provider
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      return signer;
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      return null;
    }
  } else {
    console.error('MetaMask not detected');
    return null;
  }
}

export async function makePayment(amount: string, recipient: string): Promise<string> {
  const signer = await connectWallet();
  if (signer) {
    try {
      // In ethers v6, we use parseEther directly, not from utils
      const tx = await signer.sendTransaction({
        to: recipient,
        value: parseEther(amount),
      });
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error('Transaction error:', error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    throw new Error('Failed to connect to MetaMask');
  }
} 