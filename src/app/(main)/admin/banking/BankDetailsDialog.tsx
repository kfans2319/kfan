"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import UserAvatar from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  Copy,
  Clock,
  User,
  Hash,
  CreditCard,
  Building,
  Globe,
  MapPin
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BankInfoItem {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  bankType?: "DOMESTIC" | "INTERNATIONAL";
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  routingNumber?: string;
  // International bank fields
  swiftCode?: string;
  iban?: string;
  bankAddress?: string;
  accountHolderAddress?: string;
  intermediaryBankName?: string;
  intermediaryBankSwiftCode?: string;
  createdAt: string;
  updatedAt: string;
}

interface BankDetailsDialogProps {
  bankInfo: BankInfoItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BankDetailsDialog({ 
  bankInfo, 
  open, 
  onOpenChange 
}: BankDetailsDialogProps) {
  const [copyStatus, setCopyStatus] = useState<{[key: string]: boolean}>({});
  
  const isInternationalBank = bankInfo.bankType === "INTERNATIONAL";

  const handleCopy = (text: string | undefined, field: string) => {
    if (!text) return;
    
    navigator.clipboard.writeText(text).then(() => {
      setCopyStatus(prev => ({
        ...prev,
        [field]: true
      }));
      
      // Reset copy status after 2 seconds
      setTimeout(() => {
        setCopyStatus(prev => ({
          ...prev,
          [field]: false
        }));
      }, 2000);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Building className="h-5 w-5" />
            Bank Information
          </DialogTitle>
          <DialogDescription>
            Full bank details for {bankInfo.displayName} (@{bankInfo.username})
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center gap-3 mb-4">
          <UserAvatar 
            avatarUrl={bankInfo.avatarUrl}
            className="h-12 w-12"
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{bankInfo.displayName}</h3>
              {bankInfo.isVerified && (
                <Badge className="h-5 bg-green-500 hover:bg-green-600">Verified</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">@{bankInfo.username}</p>
          </div>
        </div>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {isInternationalBank ? (
                <>
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  International Bank Details
                </>
              ) : (
                <>
                  <Building className="h-4 w-4 text-muted-foreground" />
                  Domestic (US) Bank Details
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[24px_1fr] gap-2 items-center">
              <Building className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium mb-0.5">Bank Name</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-base truncate">{bankInfo.bankName}</p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0 flex-shrink-0" 
                    onClick={() => handleCopy(bankInfo.bankName, "bankName")}
                  >
                    {copyStatus.bankName ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[24px_1fr] gap-2 items-center">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium mb-0.5">Account Holder</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-base truncate">{bankInfo.accountHolderName}</p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0 flex-shrink-0" 
                    onClick={() => handleCopy(bankInfo.accountHolderName, "accountHolder")}
                  >
                    {copyStatus.accountHolder ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[24px_1fr] gap-2 items-center">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium mb-0.5">Account Number</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-base font-mono">{bankInfo.accountNumber}</p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0 flex-shrink-0" 
                    onClick={() => handleCopy(bankInfo.accountNumber, "accountNumber")}
                  >
                    {copyStatus.accountNumber ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Display routing number for domestic banks or SWIFT/BIC code for international */}
            {!isInternationalBank ? (
              <div className="grid grid-cols-[24px_1fr] gap-2 items-center">
                <Hash className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium mb-0.5">Routing Number</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-mono">{bankInfo.routingNumber}</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 w-7 p-0 flex-shrink-0" 
                      onClick={() => handleCopy(bankInfo.routingNumber, "routingNumber")}
                    >
                      {copyStatus.routingNumber ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {bankInfo.swiftCode && (
                  <div className="grid grid-cols-[24px_1fr] gap-2 items-center">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium mb-0.5">SWIFT/BIC Code</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-mono">{bankInfo.swiftCode}</p>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 flex-shrink-0" 
                          onClick={() => handleCopy(bankInfo.swiftCode, "swiftCode")}
                        >
                          {copyStatus.swiftCode ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {bankInfo.iban && (
                  <div className="grid grid-cols-[24px_1fr] gap-2 items-center">
                    <Hash className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium mb-0.5">IBAN</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-mono">{bankInfo.iban}</p>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 flex-shrink-0" 
                          onClick={() => handleCopy(bankInfo.iban, "iban")}
                        >
                          {copyStatus.iban ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {bankInfo.bankAddress && (
                  <div className="grid grid-cols-[24px_1fr] gap-2">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-1" />
                    <div>
                      <p className="text-sm font-medium mb-0.5">Bank Address</p>
                      <div className="flex flex-col gap-1">
                        <p className="text-base">{bankInfo.bankAddress}</p>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 self-start" 
                          onClick={() => handleCopy(bankInfo.bankAddress, "bankAddress")}
                        >
                          {copyStatus.bankAddress ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {bankInfo.accountHolderAddress && (
                  <div className="grid grid-cols-[24px_1fr] gap-2">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-1" />
                    <div>
                      <p className="text-sm font-medium mb-0.5">Account Holder Address</p>
                      <div className="flex flex-col gap-1">
                        <p className="text-base">{bankInfo.accountHolderAddress}</p>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 self-start" 
                          onClick={() => handleCopy(bankInfo.accountHolderAddress, "accountHolderAddress")}
                        >
                          {copyStatus.accountHolderAddress ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        
        {/* Intermediary Bank Information (if provided) */}
        {isInternationalBank && (bankInfo.intermediaryBankName || bankInfo.intermediaryBankSwiftCode) && (
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                Intermediary Bank
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {bankInfo.intermediaryBankName && (
                <div className="grid grid-cols-[24px_1fr] gap-2 items-center">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium mb-0.5">Intermediary Bank</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base">{bankInfo.intermediaryBankName}</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0 flex-shrink-0" 
                        onClick={() => handleCopy(bankInfo.intermediaryBankName, "intermediaryBankName")}
                      >
                        {copyStatus.intermediaryBankName ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              {bankInfo.intermediaryBankSwiftCode && (
                <div className="grid grid-cols-[24px_1fr] gap-2 items-center">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium mb-0.5">Intermediary Bank SWIFT/BIC</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-mono">{bankInfo.intermediaryBankSwiftCode}</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0 flex-shrink-0" 
                        onClick={() => handleCopy(bankInfo.intermediaryBankSwiftCode, "intermediaryBankSwiftCode")}
                      >
                        {copyStatus.intermediaryBankSwiftCode ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        <div className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          <span>
            Last updated: {format(new Date(bankInfo.updatedAt), "MMMM d, yyyy 'at' h:mm a")}
          </span>
        </div>
        
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 