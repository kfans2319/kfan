import { makePayment } from '../lib/metamask';

export default function PaymentPage() {
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
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Payment Page</h1>
      <button 
        onClick={handleMetaMaskPayment}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Pay with MetaMask
      </button>
    </div>
  );
} 