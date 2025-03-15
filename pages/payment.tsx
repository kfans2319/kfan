import { makePayment } from '../lib/metamask';

const handleMetaMaskPayment = async () => {
  try {
    const txHash = await makePayment('0.01', 'your_ethereum_address');
    console.log('Payment successful. Transaction hash:', txHash);
    // Handle successful payment, e.g., update database, show success message, etc.
  } catch (error) {
    console.error('Payment failed:', error);
    // Handle payment failure, e.g., show error message
  }
};

return (
  // ...existing JSX...
  <button onClick={handleMetaMaskPayment}>Pay with MetaMask</button>
  // ...existing JSX...
); 