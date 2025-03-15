"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { useUploadThing } from "@/lib/uploadthing";
import { useRouter } from "next/navigation";
import { Camera, Upload } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import LoadingButton from "@/components/LoadingButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { getRandomVerificationPose, type VerificationPose } from "@/lib/constants";

const verificationFormSchema = z.object({
  selfieImageUrl: z.string().min(1, "Selfie image is required"),
  idImageUrl: z.string().min(1, "ID image is required"),
});

type VerificationFormValues = z.infer<typeof verificationFormSchema>;

interface VerificationFormProps {
  userId: string;
}

export default function VerificationForm({ userId }: VerificationFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingVerification, setIsUploadingVerification] = useState(false);
  const [verificationPose, setVerificationPose] = useState<VerificationPose | "">("");
  
  // Generate a random pose when the component mounts
  useEffect(() => {
    setVerificationPose(getRandomVerificationPose());
  }, []);
  
  const { startUpload: startVerificationUpload } = useUploadThing("verification");
  
  const handleFileUpload = async (file: File, type: "selfie" | "id") => {
    setIsUploadingVerification(true);
    try {
      const result = await startVerificationUpload([file]);
      
      if (result && result[0]) {
        form.setValue(
          type === "selfie" ? "selfieImageUrl" : "idImageUrl",
          result[0].url
        );
        
        // Trigger validation
        await form.trigger(type === "selfie" ? "selfieImageUrl" : "idImageUrl");
      }
    } catch (error) {
      console.error(`Error uploading ${type} image:`, error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: `Failed to upload ${type} image. Please try again.`,
      });
    } finally {
      setIsUploadingVerification(false);
    }
  };
  
  const form = useForm<VerificationFormValues>({
    resolver: zodResolver(verificationFormSchema),
    defaultValues: {
      selfieImageUrl: "",
      idImageUrl: "",
    },
  });
  
  // Submit verification request
  const onSubmit = async (values: VerificationFormValues) => {
    if (!verificationPose) {
      toast({
        variant: "destructive",
        title: "Verification Error",
        description: "Could not assign a verification pose. Please try again.",
      });
      return;
    }
    
    setIsSubmitting(true);
    console.log("Starting verification submission:", { values, userId });
    
    try {
      console.log("Sending verification API request with pose:", verificationPose);
      
      const response = await fetch("/api/verification/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selfieImageUrl: values.selfieImageUrl,
          idImageUrl: values.idImageUrl,
          userId,
          verificationPose,
        }),
      });
      
      console.log("API response status:", response.status);
      
      // Get the response data regardless of status
      const responseData = await response.json().catch(e => {
        console.error("Failed to parse response:", e);
        return null;
      });
      
      console.log("API response data:", responseData);
      
      if (!response.ok) {
        console.error("Submission error details:", responseData);
        throw new Error(`Failed to submit verification: ${response.status}`);
      }
      
      console.log("Verification submitted successfully");
      // Refresh the page to show updated status
      router.refresh();
    } catch (error) {
      console.error("Verification submission failed:", error);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: "Failed to submit verification. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Required Pose Section - moved to top level for emphasis */}
        <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h3 className="font-medium text-amber-800 dark:text-amber-300">Required Pose</h3>
          </div>
          <p className="mt-2 text-base font-medium text-amber-700 dark:text-amber-200">
            {verificationPose}
          </p>
          <p className="mt-1 text-sm text-amber-600/80 dark:text-amber-300/80">
            Please take a selfie with this exact pose to verify your identity
          </p>
        </div>
        
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Selfie Upload */}
          <FormField
            control={form.control}
            name="selfieImageUrl"
            render={({ field }) => (
              <FormItem className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel className="text-base font-medium">Selfie Photo</FormLabel>
                  {field.value && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => form.setValue("selfieImageUrl", "")}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                
                <FormControl>
                  <div className="space-y-3">
                    {field.value ? (
                      <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-muted/20">
                        <img
                          src={field.value}
                          alt="Selfie preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/10 p-4">
                        <Camera className="h-8 w-8 text-muted-foreground/70" />
                        <p className="text-center text-sm text-muted-foreground">
                          Selfie preview
                        </p>
                      </div>
                    )}
                    
                    <div className="flex justify-center">
                      <Label htmlFor="selfie-upload" className="w-full cursor-pointer">
                        <div className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                          <Upload className="h-4 w-4" />
                          {field.value ? "Change Photo" : "Upload Selfie"}
                        </div>
                        <Input
                          id="selfie-upload"
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          disabled={isUploadingVerification}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(file, "selfie");
                            }
                          }}
                        />
                      </Label>
                    </div>
                  </div>
                </FormControl>
                <FormDescription className="text-xs text-muted-foreground">
                  A clear photo of your face with the required pose shown above
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* ID Upload */}
          <FormField
            control={form.control}
            name="idImageUrl"
            render={({ field }) => (
              <FormItem className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel className="text-base font-medium">ID Document</FormLabel>
                  {field.value && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => form.setValue("idImageUrl", "")}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                
                <FormControl>
                  <div className="space-y-3">
                    {field.value ? (
                      <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-muted/20">
                        <Image
                          src={field.value}
                          alt="ID preview"
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/10 p-4">
                        <Upload className="h-8 w-8 text-muted-foreground/70" />
                        <p className="text-center text-sm text-muted-foreground">
                          Upload a photo of your ID
                        </p>
                      </div>
                    )}
                    
                    <div className="flex justify-center">
                      <Label htmlFor="id-upload" className="w-full cursor-pointer">
                        <div className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                          <Upload className="h-4 w-4" />
                          {field.value ? "Change ID" : "Upload ID"}
                        </div>
                        <Input
                          id="id-upload"
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          disabled={isUploadingVerification}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(file, "id");
                            }
                          }}
                        />
                      </Label>
                    </div>
                  </div>
                </FormControl>
                <FormDescription className="text-xs text-muted-foreground">
                  A clear photo of any government-issued ID (passport, driver's license, etc.)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        {/* Privacy information */}
        <div className="rounded-lg border border-muted-foreground/20 bg-muted/10 p-4">
          <h3 className="mb-2 text-sm font-medium">Privacy Information</h3>
          <p className="text-sm text-muted-foreground">
            Your ID and selfie photos will only be used for verification purposes and will be stored securely. 
            Only authorized administrators can view these images.
          </p>
        </div>
        
        {/* Submit button */}
        <div className="flex justify-center">
          <LoadingButton
            type="submit"
            size="lg"
            className="w-full max-w-md"
            loading={isSubmitting}
            disabled={isSubmitting || isUploadingVerification}
          >
            Submit Verification
          </LoadingButton>
        </div>
      </form>
    </Form>
  );
} 