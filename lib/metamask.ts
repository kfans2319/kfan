import { ethers } from 'ethers';

export async function connectWallet() {
  if (typeof window.ethereum !== 'undefined') {
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
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

export async function makePayment(amount: string, recipient: string) {
  const signer = await connectWallet();
  if (signer) {
    const tx = await signer.sendTransaction({
      to: recipient,
      value: ethers.utils.parseEther(amount),
    });
    await tx.wait();
    return tx.hash;
  } else {
    throw new Error('Failed to connect to MetaMask');
  }
} 