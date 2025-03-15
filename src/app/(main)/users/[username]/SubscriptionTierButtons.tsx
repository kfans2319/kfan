"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import SubscriptionTierDialog from "./SubscriptionTierDialog";

interface SubscriptionTierButtonsProps {
  tiers: {
    id: string;
    name: string; 
    description: string | null;
    price: number;
    duration: number;
    creatorId: string;
  }[];
}

export default function SubscriptionTierButtons({ tiers }: SubscriptionTierButtonsProps) {
  const [selectedTier, setSelectedTier] = useState<typeof tiers[number] | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
        {tiers.map((tier) => (
          <Button
            key={tier.id}
            variant="outline"
            className="min-w-24 text-sm sm:text-base"
            onClick={() => setSelectedTier(tier)}
          >
            {tier.name} - ${tier.price}/
            {tier.duration === 1 ? 'month' : `${tier.duration} months`}
          </Button>
        ))}
      </div>
      
      <SubscriptionTierDialog
        tier={selectedTier}
        open={!!selectedTier} 
        onOpenChange={(open) => {
          if (!open) setSelectedTier(null);
        }}
      />
    </>
  );
} 