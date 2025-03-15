/**
 * Configuration for payment handling
 * This centralizes payment-related configuration for easier management
 */

/**
 * The Ethereum address that will receive payments
 * Uses environment variable with fallback for development
 */
export const ETHEREUM_RECIPIENT_ADDRESS = 
  // In Next.js, NEXT_PUBLIC_ variables are automatically exposed to the browser
  // We don't need to check if process is defined, as Next.js handles this
  process.env.NEXT_PUBLIC_ETH_RECIPIENT_ADDRESS || "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";

/**
 * USD to ETH conversion rate
 * In production, this should come from a price feed API
 */
export const USD_TO_ETH_RATE = 0.00042; // Example: $1 USD = 0.00042 ETH

/**
 * Get blockchain explorer URL for a transaction hash
 * Supports mainnet and various testnets
 * @param txHash The transaction hash to link to
 * @param networkName The network name (defaults to 'Ethereum' for mainnet)
 * @returns The full URL to the appropriate blockchain explorer
 */
export function getExplorerUrl(txHash: string, networkName: string = 'Ethereum'): string {
  if (!txHash) return '';
  
  // Default to mainnet if not specified or unknown
  switch(networkName.toLowerCase()) {
    case 'ethereum':
    case 'mainnet':
      return `https://etherscan.io/tx/${txHash}`;
    case 'sepolia':
      return `https://sepolia.etherscan.io/tx/${txHash}`;
    case 'goerli':
      return `https://goerli.etherscan.io/tx/${txHash}`;
    case 'mumbai':
      return `https://mumbai.polygonscan.com/tx/${txHash}`;
    default:
      // Default to mainnet for unknown networks
      return `https://etherscan.io/tx/${txHash}`;
  }
}
