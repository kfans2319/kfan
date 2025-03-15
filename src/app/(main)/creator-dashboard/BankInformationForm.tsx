"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown, ChevronUp, CreditCard, KeySquare, Landmark, User, Globe, Building, MapPin } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface BankInformationFormProps {
  userId: string;
  existingBankInfo: any;
}

// Define API error response type
interface ApiError {
  error: string;
  details?: {
    [field: string]: {
      _errors: string[];
    };
  };
}

export default function BankInformationForm({ userId, existingBankInfo }: BankInformationFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery("(max-width: 640px)");
  
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    bankType: "DOMESTIC",
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    routingNumber: "",
    // International bank fields
    swiftCode: "",
    iban: "",
    bankAddress: "",
    accountHolderAddress: "",
    intermediaryBankName: "",
    intermediaryBankSwiftCode: "",
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [success, setSuccess] = useState(false);
  const [expanded, setExpanded] = useState(!existingBankInfo);
  
  // Load existing bank info if available
  useEffect(() => {
    if (existingBankInfo) {
      setFormData({
        bankType: existingBankInfo.bankType || "DOMESTIC",
        accountHolderName: existingBankInfo.accountHolderName || "",
        bankName: existingBankInfo.bankName || "",
        accountNumber: existingBankInfo.accountNumber || "",
        routingNumber: existingBankInfo.routingNumber || "",
        // International bank fields
        swiftCode: existingBankInfo.swiftCode || "",
        iban: existingBankInfo.iban || "",
        bankAddress: existingBankInfo.bankAddress || "",
        accountHolderAddress: existingBankInfo.accountHolderAddress || "",
        intermediaryBankName: existingBankInfo.intermediaryBankName || "",
        intermediaryBankSwiftCode: existingBankInfo.intermediaryBankSwiftCode || "",
      });
    }
  }, [existingBankInfo]);
  
  const isInternationalBank = formData.bankType === "INTERNATIONAL";
  
  // Client-side field validation
  const validateFields = () => {
    const errors: {[key: string]: string} = {};
    
    // Common field validation
    if (!formData.accountHolderName.trim()) {
      errors.accountHolderName = "Account holder name is required";
    }
    
    if (!formData.bankName.trim()) {
      errors.bankName = "Bank name is required";
    }
    
    if (!formData.accountNumber.trim()) {
      errors.accountNumber = "Account number is required";
    }
    
    // Domestic bank validation
    if (formData.bankType === "DOMESTIC" && !formData.routingNumber.trim()) {
      errors.routingNumber = "Routing number is required for domestic bank accounts";
    }
    
    // International bank validation
    if (formData.bankType === "INTERNATIONAL") {
      if (!formData.swiftCode.trim()) {
        errors.swiftCode = "SWIFT/BIC code is required for international transfers";
      }
      
      if (!formData.bankAddress.trim()) {
        errors.bankAddress = "Bank address is required for international transfers";
      }
      
      if (!formData.accountHolderAddress.trim()) {
        errors.accountHolderAddress = "Account holder address is required for international transfers";
      }
    }
    
    return errors;
  };
  
  const validateForm = () => {
    const errors = validateFields();
    return Object.keys(errors).length === 0;
  };
  
  const isValidForm = validateForm();
  
  // Function to handle API error responses and extract field errors
  const parseApiError = (error: any): { message: string, fields: {[key: string]: string} } => {
    console.log("API Error details:", error);
    
    // Default generic error
    let message = "Failed to save bank information. Please try again.";
    let fields: {[key: string]: string} = {};
    
    try {
      // If the error has a response with data
      if (error.data) {
        // Extract the main error message
        if (error.data.error) {
          message = error.data.error;
        }
        
        // Extract field-specific errors from Zod validation
        if (error.data.details) {
          Object.entries(error.data.details).forEach(([field, fieldError]: [string, any]) => {
            // Skip _errors if it's not meant for a specific field
            if (field === '_errors') return;
            
            // Extract the error message from the _errors array
            if (fieldError._errors && fieldError._errors.length > 0) {
              fields[field] = fieldError._errors[0];
            }
          });
        }
      } 
      // If the error is a string message
      else if (typeof error === 'string') {
        message = error;
      } 
      // If the error is an Error object
      else if (error instanceof Error) {
        message = error.message;
      }
      
      // If no specific field errors were found but we have a message that might indicate field issues
      if (Object.keys(fields).length === 0) {
        // Extract field hints from the error message
        if (message.includes("Bank name")) {
          fields.bankName = "Please enter a valid bank name";
        }
        if (message.includes("Account number")) {
          fields.accountNumber = "Please enter a valid account number";
        }
        if (message.includes("Account holder")) {
          fields.accountHolderName = "Please enter a valid account holder name";
        }
        if (message.includes("Routing number")) {
          fields.routingNumber = "Please enter a valid routing number";
        }
        if (message.includes("SWIFT") || message.includes("BIC")) {
          fields.swiftCode = "Please enter a valid SWIFT/BIC code";
        }
        if (message.includes("IBAN")) {
          fields.iban = "Please enter a valid IBAN";
        }
        if (message.includes("Bank address")) {
          fields.bankAddress = "Please enter a valid bank address";
        }
        if (message.includes("Account holder address")) {
          fields.accountHolderAddress = "Please enter a valid account holder address";
        }
      }
    } catch (e) {
      console.error("Error parsing API error:", e);
    }
    
    return { message, fields };
  };
  
  // Save bank information mutation with improved error handling
  const mutation = useMutation({
    mutationFn: async () => {
      setSubmitting(true);
      setError(null);
      setFieldErrors({});
      setSuccess(false);
      
      try {
        const response = await fetch("/api/creator/bank-info", {
          method: existingBankInfo ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw { 
            status: response.status,
            data: data
          };
        }
        
        return data;
      } finally {
        setSubmitting(false);
      }
    },
    onSuccess: (data) => {
      console.log("Bank information saved successfully:", data);
      
      toast({
        title: "Bank information saved",
        description: "Your bank information has been saved successfully",
      });
      setSuccess(true);
      setShowConfirmation(false);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["bankInformation"] });
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
        setExpanded(false);
      }, 3000);
    },
    onError: (error: any) => {
      console.error("Error saving bank information:", error);
      
      // Parse the error to extract field-specific errors
      const { message, fields } = parseApiError(error);
      
      // Set the main error message
      setError(message);
      
      // Set field-specific errors
      if (Object.keys(fields).length > 0) {
        setFieldErrors(fields);
        
        // If we're in confirmation mode but there are errors, go back to edit mode
        if (showConfirmation) {
          setShowConfirmation(false);
        }
      }
      
      // Show toast for error
      toast({
        title: "Error saving bank information",
        description: message,
        variant: "destructive",
      });
    },
  });
  
  // Helper functions for field error display
  const getFieldError = (fieldName: string) => {
    return fieldErrors[fieldName] || "";
  };
  
  const hasFieldError = (fieldName: string) => {
    return !!fieldErrors[fieldName];
  };
  
  // Handle form field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Clear error for this field when user starts typing in it
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };
  
  // Handle bank type changes
  const handleBankTypeChange = (value: string) => {
    // Reset field errors when switching bank types
    setFieldErrors({});
    setError(null);
    
    setFormData(prev => ({
      ...prev,
      bankType: value,
    }));
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate fields client-side
    const errors = validateFields();
    
    // Set field errors from validation
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError(`Please fix the ${Object.keys(errors).length} ${Object.keys(errors).length === 1 ? 'error' : 'errors'} in the form.`);
      
      // Don't proceed to confirmation if there are errors
      return;
    }
    
    // Clear previous errors
    setFieldErrors({});
    setError(null);
    
    // If validation passes and we're not showing confirmation yet, show confirmation
    if (!showConfirmation) {
      setShowConfirmation(true);
      return;
    }
    
    // If confirmation is shown and validation passed, submit the form
    mutation.mutate();
  };
  
  // Handle cancellation
  const handleCancel = () => {
    setShowConfirmation(false);
    setError(null);
    
    // Reset form to existing data if available
    if (existingBankInfo) {
      setFormData({
        bankType: existingBankInfo.bankType || "DOMESTIC",
        accountHolderName: existingBankInfo.accountHolderName || "",
        bankName: existingBankInfo.bankName || "",
        accountNumber: existingBankInfo.accountNumber || "",
        routingNumber: existingBankInfo.routingNumber || "",
        // International bank fields
        swiftCode: existingBankInfo.swiftCode || "",
        iban: existingBankInfo.iban || "",
        bankAddress: existingBankInfo.bankAddress || "",
        accountHolderAddress: existingBankInfo.accountHolderAddress || "",
        intermediaryBankName: existingBankInfo.intermediaryBankName || "",
        intermediaryBankSwiftCode: existingBankInfo.intermediaryBankSwiftCode || "",
      });
    }
  };
  
  return (
    <Card className="w-full mb-6">
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <CardTitle className="text-lg md:text-xl">Bank Information</CardTitle>
          </div>
          <div>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
        {!expanded && existingBankInfo && (
          <CardDescription className="text-sm">
            Account ending in {existingBankInfo.accountNumber?.slice(-4)} at {existingBankInfo.bankName}
            {existingBankInfo.bankType === "INTERNATIONAL" && " (International)"}
          </CardDescription>
        )}
      </CardHeader>
      
      {expanded && (
        <CardContent>
          {success ? (
            <Alert className="bg-green-50 text-green-700 mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>Your bank information has been saved successfully.</AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && (
                <Alert className="bg-rose-50 text-rose-700 mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="mb-4">
                <Label htmlFor="bankType">Bank Type</Label>
                <Select 
                  value={formData.bankType} 
                  onValueChange={handleBankTypeChange}
                >
                  <SelectTrigger 
                    id="bankType"
                    className={`w-full ${hasFieldError('bankType') ? 'border-rose-500 ring-rose-500' : ''}`}
                  >
                    <SelectValue placeholder="Select bank type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DOMESTIC">Domestic (US) Bank</SelectItem>
                    <SelectItem value="INTERNATIONAL">International Bank</SelectItem>
                  </SelectContent>
                </Select>
                {hasFieldError('bankType') && (
                  <p className="text-rose-500 text-xs mt-1">{getFieldError('bankType')}</p>
                )}
              </div>
              
              <div className="mb-4">
                <Label htmlFor="accountHolderName" className={hasFieldError('accountHolderName') ? 'text-rose-500' : ''}>
                  Account Holder Name
                </Label>
                <div className="flex items-center relative">
                  <User className="absolute left-3 h-4 w-4 text-gray-500" />
                  <Input
                    id="accountHolderName"
                    name="accountHolderName"
                    placeholder="Full name on bank account"
                    className={`pl-10 ${hasFieldError('accountHolderName') ? 'border-rose-500 ring-rose-500' : ''}`}
                    value={formData.accountHolderName}
                    onChange={handleChange}
                  />
                </div>
                {hasFieldError('accountHolderName') && (
                  <p className="text-rose-500 text-xs mt-1">{getFieldError('accountHolderName')}</p>
                )}
              </div>
              
              <div className="mb-4">
                <Label htmlFor="bankName" className={hasFieldError('bankName') ? 'text-rose-500' : ''}>
                  Bank Name
                </Label>
                <div className="flex items-center relative">
                  <Landmark className="absolute left-3 h-4 w-4 text-gray-500" />
                  <Input
                    id="bankName"
                    name="bankName"
                    placeholder="Name of your bank"
                    className={`pl-10 ${hasFieldError('bankName') ? 'border-rose-500 ring-rose-500' : ''}`}
                    value={formData.bankName}
                    onChange={handleChange}
                  />
                </div>
                {hasFieldError('bankName') && (
                  <p className="text-rose-500 text-xs mt-1">{getFieldError('bankName')}</p>
                )}
              </div>
              
              <div className="mb-4">
                <Label htmlFor="accountNumber" className={hasFieldError('accountNumber') ? 'text-rose-500' : ''}>
                  Account Number
                </Label>
                <div className="flex items-center relative">
                  <CreditCard className="absolute left-3 h-4 w-4 text-gray-500" />
                  <Input
                    id="accountNumber"
                    name="accountNumber"
                    placeholder="Bank account number"
                    className={`pl-10 ${hasFieldError('accountNumber') ? 'border-rose-500 ring-rose-500' : ''}`}
                    value={formData.accountNumber}
                    onChange={handleChange}
                  />
                </div>
                {hasFieldError('accountNumber') && (
                  <p className="text-rose-500 text-xs mt-1">{getFieldError('accountNumber')}</p>
                )}
              </div>
              
              {!isInternationalBank && (
                <div className="mb-4">
                  <Label htmlFor="routingNumber" className={hasFieldError('routingNumber') ? 'text-rose-500' : ''}>
                    Routing Number
                  </Label>
                  <div className="flex items-center relative">
                    <KeySquare className="absolute left-3 h-4 w-4 text-gray-500" />
                    <Input
                      id="routingNumber"
                      name="routingNumber"
                      placeholder="9-digit routing number"
                      className={`pl-10 ${hasFieldError('routingNumber') ? 'border-rose-500 ring-rose-500' : ''}`}
                      value={formData.routingNumber}
                      onChange={handleChange}
                    />
                  </div>
                  {hasFieldError('routingNumber') && (
                    <p className="text-rose-500 text-xs mt-1">{getFieldError('routingNumber')}</p>
                  )}
                </div>
              )}
              
              {/* International Bank Fields */}
              {isInternationalBank && (
                <>
                  <div className="mb-4">
                    <Label htmlFor="swiftCode" className={hasFieldError('swiftCode') ? 'text-rose-500' : ''}>
                      SWIFT/BIC Code
                    </Label>
                    <div className="flex items-center relative">
                      <Globe className="absolute left-3 h-4 w-4 text-gray-500" />
                      <Input
                        id="swiftCode"
                        name="swiftCode"
                        placeholder="SWIFT or BIC code (e.g., AAAABB2L)"
                        className={`pl-10 ${hasFieldError('swiftCode') ? 'border-rose-500 ring-rose-500' : ''}`}
                        value={formData.swiftCode}
                        onChange={handleChange}
                      />
                    </div>
                    {hasFieldError('swiftCode') && (
                      <p className="text-rose-500 text-xs mt-1">{getFieldError('swiftCode')}</p>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <Label htmlFor="iban" className={hasFieldError('iban') ? 'text-rose-500' : ''}>
                      IBAN (Optional)
                    </Label>
                    <div className="flex items-center relative">
                      <KeySquare className="absolute left-3 h-4 w-4 text-gray-500" />
                      <Input
                        id="iban"
                        name="iban"
                        placeholder="International Bank Account Number"
                        className={`pl-10 ${hasFieldError('iban') ? 'border-rose-500 ring-rose-500' : ''}`}
                        value={formData.iban}
                        onChange={handleChange}
                      />
                    </div>
                    {hasFieldError('iban') && (
                      <p className="text-rose-500 text-xs mt-1">{getFieldError('iban')}</p>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <Label htmlFor="routingNumber" className={hasFieldError('routingNumber') ? 'text-rose-500' : ''}>
                      Routing Number (Optional for international banks)
                    </Label>
                    <div className="flex items-center relative">
                      <KeySquare className="absolute left-3 h-4 w-4 text-gray-500" />
                      <Input
                        id="routingNumber"
                        name="routingNumber"
                        placeholder="Routing number (if applicable)"
                        className={`pl-10 ${hasFieldError('routingNumber') ? 'border-rose-500 ring-rose-500' : ''}`}
                        value={formData.routingNumber}
                        onChange={handleChange}
                      />
                    </div>
                    {hasFieldError('routingNumber') && (
                      <p className="text-rose-500 text-xs mt-1">{getFieldError('routingNumber')}</p>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <Label htmlFor="bankAddress" className={hasFieldError('bankAddress') ? 'text-rose-500' : ''}>
                      Bank Address
                    </Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                      <Textarea
                        id="bankAddress"
                        name="bankAddress"
                        placeholder="Complete address of your bank"
                        className={`pl-10 ${hasFieldError('bankAddress') ? 'border-rose-500 ring-rose-500' : ''}`}
                        value={formData.bankAddress}
                        onChange={handleChange}
                        rows={3}
                      />
                    </div>
                    {hasFieldError('bankAddress') && (
                      <p className="text-rose-500 text-xs mt-1">{getFieldError('bankAddress')}</p>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <Label htmlFor="accountHolderAddress" className={hasFieldError('accountHolderAddress') ? 'text-rose-500' : ''}>
                      Account Holder Address
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                      <Textarea
                        id="accountHolderAddress"
                        name="accountHolderAddress"
                        placeholder="Your address as registered with the bank"
                        className={`pl-10 ${hasFieldError('accountHolderAddress') ? 'border-rose-500 ring-rose-500' : ''}`}
                        value={formData.accountHolderAddress}
                        onChange={handleChange}
                        rows={3}
                      />
                    </div>
                    {hasFieldError('accountHolderAddress') && (
                      <p className="text-rose-500 text-xs mt-1">{getFieldError('accountHolderAddress')}</p>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <Label htmlFor="intermediaryBankName">
                      Intermediary Bank Name (Optional)
                    </Label>
                    <div className="flex items-center relative">
                      <Landmark className="absolute left-3 h-4 w-4 text-gray-500" />
                      <Input
                        id="intermediaryBankName"
                        name="intermediaryBankName"
                        placeholder="Name of intermediary bank (if required)"
                        className="pl-10"
                        value={formData.intermediaryBankName}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <Label htmlFor="intermediaryBankSwiftCode">
                      Intermediary Bank SWIFT Code (Optional)
                    </Label>
                    <div className="flex items-center relative">
                      <Globe className="absolute left-3 h-4 w-4 text-gray-500" />
                      <Input
                        id="intermediaryBankSwiftCode"
                        name="intermediaryBankSwiftCode"
                        placeholder="SWIFT code of intermediary bank"
                        className="pl-10"
                        value={formData.intermediaryBankSwiftCode}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                  
                  <Alert className="bg-blue-50 text-blue-700 mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>International Bank Transfer</AlertTitle>
                    <AlertDescription>
                      International transfers may take 3-5 business days to process and may incur additional fees.
                      Please ensure all information is accurate to avoid transfer delays.
                    </AlertDescription>
                  </Alert>
                </>
              )}
              
              {showConfirmation ? (
                <div className="space-y-4">
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">Please verify your banking details</AlertTitle>
                    <AlertDescription className="text-amber-700">
                      Please confirm that all information is correct. Once submitted, you'll need to contact support to make changes.
                      
                      {Object.keys(fieldErrors).length > 0 && (
                        <div className="mt-2 text-rose-600">
                          <p className="font-medium">Please correct the following errors:</p>
                          <ul className="list-disc pl-5 mt-1 space-y-1">
                            {Object.entries(fieldErrors).map(([field, error]) => (
                              <li key={field}>
                                <span className="font-medium">{field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</span> {error}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex space-x-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={submitting}
                    >
                      Edit Information
                    </Button>
                    <Button 
                      type="submit"
                      disabled={submitting || !isValidForm}
                    >
                      {submitting ? "Saving..." : "Confirm & Save"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end space-x-2">
                  {existingBankInfo && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setExpanded(false)}
                      className="mr-auto"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button 
                    type="submit"
                    disabled={submitting || !isValidForm}
                  >
                    {submitting ? "Saving..." : existingBankInfo ? "Update Information" : "Save Information"}
                  </Button>
                </div>
              )}
            </form>
          )}
        </CardContent>
      )}
    </Card>
  );
} 