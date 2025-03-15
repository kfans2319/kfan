"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { formatDate } from "date-fns";
import Link from "next/link";
import UserAvatar from "./UserAvatar";
import { Badge } from "./ui/badge";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { Subscription } from "@/hooks/useSubscriptions";
import LoadingButton from "./LoadingButton";
import { formatNumber } from "@/lib/utils";

interface SubscriptionCardProps {
  subscription: Subscription;
  onCancel: (id: string) => void;
  isLoading?: boolean;
}

export default function SubscriptionCard({ 
  subscription, 
  onCancel,
  isLoading = false,
}: SubscriptionCardProps) {
  const [open, setOpen] = useState(false);
  const creator = subscription.tier.creator;
  const expiresAt = new Date(subscription.expiresAt);
  const isExpiringSoon = expiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000; // 7 days
  
  const handleCancel = () => {
    onCancel(subscription.id);
    setOpen(false);
  };

  return (
    <Card className="overflow-hidden shadow-sm hover:shadow-md transition-all bg-card h-full flex flex-col group">
      <CardHeader className="bg-muted/20 p-0">
        <Link 
          href={`/users/${creator.username}`} 
          className="block overflow-hidden p-4 transition-colors hover:bg-muted/40"
        >
          <div className="flex items-center gap-3">
            <UserAvatar avatarUrl={creator.avatarUrl} size={48} />
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-medium text-base group-hover:text-primary transition-colors">
                {creator.displayName}
              </h3>
              <p className="truncate text-sm text-muted-foreground">
                @{creator.username}
              </p>
            </div>
          </div>
        </Link>
      </CardHeader>
      
      <CardContent className="p-4 flex-grow flex flex-col">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{subscription.tier.name}</h4>
            {subscription.autoRenew ? (
              <Badge variant="default" className="bg-green-500/15 text-green-600 hover:bg-green-500/25 border-green-200">
                Auto-renew
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 border-amber-200">
                Expires soon
              </Badge>
            )}
          </div>
          <div className="text-sm font-medium">
            ${formatNumber(subscription.tier.price)} / 
            {subscription.tier.duration === 1 
              ? "month" 
              : `${subscription.tier.duration} months`}
          </div>
        </div>
        
        {subscription.tier.description && (
          <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
            {subscription.tier.description}
          </p>
        )}
        
        <div className="text-sm mt-auto pt-3 border-t border-border/40">
          <p className={`${isExpiringSoon ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
            Expires: {formatDate(expiresAt, "MMMM d, yyyy")}
          </p>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-end gap-2 bg-muted/20 p-4 border-t border-border/40">
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              disabled={!subscription.autoRenew || isLoading}
              className={subscription.autoRenew 
                ? "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" 
                : "opacity-50"}
            >
              {subscription.autoRenew ? "Cancel" : "Canceled"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel your subscription to {creator.displayName}? 
                Your subscription will remain active until {formatDate(expiresAt, "MMMM d, yyyy")} 
                but will not renew after that date.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
              <LoadingButton 
                loading={isLoading}
                onClick={handleCancel}
                variant="destructive"
              >
                Cancel Subscription
              </LoadingButton>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        <Button 
          size="sm" 
          asChild 
          className="bg-primary/90 hover:bg-primary transition-colors"
        >
          <Link href={`/users/${creator.username}`}>
            Visit Profile
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
} 