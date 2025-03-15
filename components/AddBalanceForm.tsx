import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const balanceOptions = [
  { value: 'price_option1', label: '$10' },
  { value: 'price_option2', label: '$25' },
  { value: 'price_option3', label: '$50' },
  { value: 'price_option4', label: '$100' },
];

export default function AddBalanceForm() {
  const [selectedOption, setSelectedOption] = useState(balanceOptions[0].value);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId: selectedOption }),
    });

    const { url } = await response.json();
    window.location.href = url;
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="balance-option">Select Balance Option:</label>
      <select
        id="balance-option"
        value={selectedOption}
        onChange={(e) => setSelectedOption(e.target.value)}
      >
        {balanceOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Add Balance'}
      </button>
    </form>
  );
} 