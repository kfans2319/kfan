import {
  Dialog,
  DialogContent, 
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useSession } from "@/app/(main)/SessionProvider";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

interface SubscriptionTierDialogProps {
  tier: {
    id: string;
    name: string;
    description: string | null; 
    price: number;
    duration: number;
    creatorId: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SubscriptionTierDialog({
  tier,
  open,
  onOpenChange,  
}: SubscriptionTierDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useSession();
  const router = useRouter();

  if (!tier) return null;

  const handlePurchase = async () => {
    if (!user || !tier) return;
    
    setIsLoading(true);
    try {
      // Check if the user is the creator of the tier
      if (tier.creatorId === user.id) {
        toast({
          title: "Cannot subscribe to your own tier",
          description: "You cannot subscribe to your own subscription tier.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Check if user has enough balance
      const userBalance = Number(user.balance || 0);
      if (userBalance < tier.price) {
        toast({
          title: "Insufficient balance",
          description: "Your balance is too low to purchase this subscription tier. Please add funds to your wallet.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Create subscription
      const response = await fetch('/api/subscription/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tierId: tier.id,
          autoRenew: true
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to purchase subscription");
      }

      toast({
        title: "Subscription purchased",
        description: `You have successfully subscribed to ${tier.name}!`,
      });

      // Close dialog and refresh the page to update UI
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error("Error purchasing subscription:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[90vw]">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl">{tier.name}</DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            {tier.description || "No description provided"}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-2 text-sm sm:text-base">
          <p>
            <span className="font-medium">Price:</span> ${tier.price}
          </p>
          <p>
            <span className="font-medium">Duration:</span> {tier.duration === 1 ? '1 month' : `${tier.duration} months`}
          </p>  
        </div>
        <DialogFooter className="mt-6">
          <div className="w-full space-y-4">
            <p className="text-center text-sm sm:text-base text-muted-foreground">
              Would you like to purchase this subscription tier?
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                onClick={handlePurchase} 
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                {isLoading ? "Processing..." : "Purchase"}
              </Button>
            </div>
            {user && (
              <p className="text-center text-xs sm:text-sm text-muted-foreground">
                Your current balance: ${Number(user.balance || 0).toFixed(2)}
              </p>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 