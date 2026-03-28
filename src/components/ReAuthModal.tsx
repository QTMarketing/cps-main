"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Lock, 
  Eye, 
  EyeOff, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";

// =============================================================================
// VALIDATION SCHEMA
// =============================================================================

const reAuthSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

type ReAuthFormData = z.infer<typeof reAuthSchema>;

// =============================================================================
// PROPS INTERFACE
// =============================================================================

interface ReAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
  sensitiveAction?: string;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ReAuthModal({
  isOpen,
  onClose,
  onSuccess,
  title = "Re-authentication Required",
  description = "Please confirm your password to continue with this sensitive operation.",
  sensitiveAction,
}: ReAuthModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setFocus,
  } = useForm<ReAuthFormData>({
    resolver: zodResolver(reAuthSchema),
  });

  // =============================================================================
  // EFFECTS
  // =============================================================================

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setAttempts(0);
      setIsLocked(false);
      reset();
      // Focus on password input when modal opens
      setTimeout(() => setFocus("password"), 100);
    }
  }, [isOpen, reset, setFocus]);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const onSubmit = async (data: ReAuthFormData) => {
    if (isLocked) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: data.password }),
      });

      const result = await response.json();

      if (response.ok) {
        // Success - close modal and call success callback
        onSuccess();
        onClose();
        reset();
      } else {
        // Handle different error types
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= 3) {
          setIsLocked(true);
          setError("Too many failed attempts. Please wait 5 minutes before trying again.");
        } else {
          setError(result.error || "Invalid password. Please try again.");
        }
      }
    } catch (error) {
      console.error("Re-auth error:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
      reset();
      setError(null);
      setAttempts(0);
      setIsLocked(false);
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Lock className="h-5 w-5 text-blue-500" />
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription>
            {description}
            {sensitiveAction && (
              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                <div className="flex items-center space-x-2 text-sm text-yellow-800 dark:text-yellow-200">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Sensitive Action: {sensitiveAction}</span>
                </div>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Password Input */}
          <div className="space-y-2">
            <Label htmlFor="password">Current Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                {...register("password")}
                placeholder="Enter your current password"
                className="pr-10"
                disabled={isLoading || isLocked}
                autoComplete="current-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading || isLocked}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Attempts Counter */}
          {attempts > 0 && !isLocked && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Failed attempts: {attempts}/3
              </AlertDescription>
            </Alert>
          )}

          {/* Locked State */}
          {isLocked && (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Account temporarily locked due to multiple failed attempts.
                Please wait 5 minutes before trying again.
              </AlertDescription>
            </Alert>
          )}

          {/* Security Notice */}
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Notice:</strong> This re-authentication is required 
              for sensitive operations. Your password is verified securely and 
              not stored or transmitted in plain text.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || isLocked}
              className="min-w-[100px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Password"
              )}
            </Button>
          </div>
        </form>

        {/* Footer */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Re-authentication expires after 5 minutes of inactivity
        </div>
      </DialogContent>
    </Dialog>
  );
}





