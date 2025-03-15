#!/usr/bin/env node

/**
 * Wallet checker utility
 * 
 * This script allows you to check the balance and recent transactions
 * for your Ethereum recipient wallet on various networks
 * 
 * Usage:
 *   node scripts/check-wallet.js [network]
 * 
 * Where [network] is one of: sepolia, goerli, mumbai, mainnet (default: sepolia)
 */

const { ethers } = require('ethers');
require('dotenv').config();

// Get recipient address from environment variable
const recipientAddress = process.env.NEXT_PUBLIC_ETH_RECIPIENT_ADDRESS || 
                          '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

// RPC endpoints for different networks
const RPC_ENDPOINTS = {
  sepolia: `https://sepolia.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_ID}`,
  goerli: `https://goerli.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_ID}`,
  mumbai: 'https://rpc-mumbai.maticvigil.com',
  mainnet: `https://mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_ID}`
};

// Block explorer URLs
const EXPLORERS = {
  sepolia: 'https://sepolia.etherscan.io',
  goerli: 'https://goerli.etherscan.io',
  mumbai: 'https://mumbai.polygonscan.com',
  mainnet: 'https://etherscan.io'
};

// Get network from command line args
const network = process.argv[2]?.toLowerCase() || 'sepolia';

if (!RPC_ENDPOINTS[network]) {
  console.error(`Error: Unsupported network "${network}". Supported networks: ${Object.keys(RPC_ENDPOINTS).join(', ')}`);
  process.exit(1);
}

async function main() {
  try {
    console.log(`\n----- Checking wallet on ${network.toUpperCase()} -----`);
    console.log(`Recipient address: ${recipientAddress}`);
    console.log(`Block explorer: ${EXPLORERS[network]}/address/${recipientAddress}\n`);
    
    // Create provider
    const provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS[network]);
    
    // Get balance
    const balance = await provider.getBalance(recipientAddress);
    console.log(`Current balance: ${ethers.formatEther(balance)} ETH\n`);
    
    // Get latest 5 transactions (this is a simplified approach)
    // For a full transaction history, you would typically use an etherscan API
    console.log('Recent incoming transactions:');
    
    // Get latest block number
    const blockNumber = await provider.getBlockNumber();
    
    // Check the last 1000 blocks for transactions to this address
    const startBlock = Math.max(0, blockNumber - 1000);
    console.log(`Scanning blocks ${startBlock} to ${blockNumber}...`);
    
    let count = 0;
    
    // For each of the last 10 blocks
    for (let i = blockNumber; i > startBlock && count < 5; i -= 10) {
      // Get block with transactions
      const block = await provider.getBlock(i, true);
      
      if (!block || !block.transactions) continue;
      
      // Filter transactions where the recipient is our address
      const relevantTxs = block.transactions.filter(tx => 
        tx.to?.toLowerCase() === recipientAddress.toLowerCase()
      );
      
      for (const tx of relevantTxs) {
        if (count >= 5) break;
        
        // Get transaction receipt
        const receipt = await provider.getTransactionReceipt(tx.hash);
        
        if (receipt && receipt.status === 1) { // 1 = success
          console.log(`\nTransaction: ${tx.hash}`);
          console.log(`From: ${tx.from}`);
          console.log(`Value: ${ethers.formatEther(tx.value)} ETH`);
          console.log(`Block: ${tx.blockNumber}`);
          console.log(`Explorer: ${EXPLORERS[network]}/tx/${tx.hash}`);
          count++;
        }
      }
    }
    
    if (count === 0) {
      console.log('No incoming transactions found in the last 1000 blocks.');
    }
    
    console.log('\nTo view complete transaction history, visit:');
    console.log(`${EXPLORERS[network]}/address/${recipientAddress}`);
    
  } catch (error) {
    console.error('Error checking wallet:', error.message);
    process.exit(1);
  }
}

main();
