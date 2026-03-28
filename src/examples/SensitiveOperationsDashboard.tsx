"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ReAuthModal } from "@/components/ReAuthModal";
import { useReAuth } from "@/hooks/useReAuth";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  DollarSign,
  UserX,
  CreditCard
} from "lucide-react";

// =============================================================================
// EXAMPLE COMPONENT: Sensitive Operations Dashboard
// =============================================================================

export function SensitiveOperationsDashboard() {
  const [showReAuthModal, setShowReAuthModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionData, setActionData] = useState<any>(null);

  const {
    isRequired,
    isLoading,
    error,
    timeRemaining,
    verifyPassword,
    requireReAuth,
    clearReAuth,
    hasValidReAuth,
    timeRemainingFormatted,
  } = useReAuth({
    onSuccess: () => {
      // Execute the pending action after successful re-auth
      if (pendingAction && actionData) {
        executeAction(pendingAction, actionData);
        setPendingAction(null);
        setActionData(null);
      }
    },
    onError: (error) => {
      console.error('Re-authentication failed:', error);
    },
  });

  // =============================================================================
  // ACTION HANDLERS
  // =============================================================================

  const handleVoidCheck = async (checkId: string) => {
    if (hasValidReAuth) {
      await executeAction('voidCheck', { checkId });
    } else {
      setPendingAction('voidCheck');
      setActionData({ checkId });
      setShowReAuthModal(true);
    }
  };

  const handleLargePayment = async (amount: number, vendorId: string) => {
    if (amount >= 10000) {
      if (hasValidReAuth) {
        await executeAction('largePayment', { amount, vendorId });
      } else {
        setPendingAction('largePayment');
        setActionData({ amount, vendorId });
        setShowReAuthModal(true);
      }
    } else {
      await executeAction('smallPayment', { amount, vendorId });
    }
  };

  const handleChangeBankInfo = async (bankId: string) => {
    if (hasValidReAuth) {
      await executeAction('changeBankInfo', { bankId });
    } else {
      setPendingAction('changeBankInfo');
      setActionData({ bankId });
      setShowReAuthModal(true);
    }
  };

  const handleAddUser = async (userData: any) => {
    if (hasValidReAuth) {
      await executeAction('addUser', userData);
    } else {
      setPendingAction('addUser');
      setActionData(userData);
      setShowReAuthModal(true);
    }
  };

  const executeAction = async (action: string, data: any) => {
    try {
      console.log(`Executing ${action} with data:`, data);
      
      // Here you would make the actual API call
      // const response = await fetch(`/api/${action}`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(data),
      // });
      
      // For demo purposes, just log the action
      console.log(`✅ ${action} completed successfully`);
      
    } catch (error) {
      console.error(`❌ ${action} failed:`, error);
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="space-y-6">
      {/* Re-Auth Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-500" />
            <span>Re-Authentication Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasValidReAuth ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>Re-authentication is valid</span>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Expires in: {timeRemainingFormatted}</span>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Re-authentication required for sensitive operations
              </AlertDescription>
            </Alert>
          )}

          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => requireReAuth()}
              disabled={isLoading}
            >
              Require Re-Auth
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearReAuth}
              disabled={isLoading}
            >
              Clear Re-Auth
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sensitive Operations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Void Check */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <UserX className="h-5 w-5 text-red-500" />
              <span>Void Check</span>
            </CardTitle>
            <CardDescription>
              Cancel or void a pending check
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleVoidCheck('check-123')}
              variant="destructive"
              disabled={isLoading}
            >
              Void Check #123
            </Button>
          </CardContent>
        </Card>

        {/* Large Payment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <span>Large Payment</span>
            </CardTitle>
            <CardDescription>
              Process payment over $10,000
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleLargePayment(15000, 'vendor-456')}
              disabled={isLoading}
            >
              Process $15,000 Payment
            </Button>
          </CardContent>
        </Card>

        {/* Change Bank Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5 text-blue-500" />
              <span>Change Bank Info</span>
            </CardTitle>
            <CardDescription>
              Update bank account information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleChangeBankInfo('bank-789')}
              variant="outline"
              disabled={isLoading}
            >
              Update Bank Details
            </Button>
          </CardContent>
        </Card>

        {/* Add User */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <UserX className="h-5 w-5 text-purple-500" />
              <span>Add User</span>
            </CardTitle>
            <CardDescription>
              Create a new user account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleAddUser({ username: 'newuser', role: 'USER' })}
              disabled={isLoading}
            >
              Add New User
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Re-Auth Modal */}
      <ReAuthModal
        isOpen={showReAuthModal}
        onClose={() => {
          setShowReAuthModal(false);
          setPendingAction(null);
          setActionData(null);
        }}
        onSuccess={() => {
          setShowReAuthModal(false);
        }}
        title="Re-authentication Required"
        description="Please confirm your password to continue with this sensitive operation."
        sensitiveAction={pendingAction ? `Action: ${pendingAction}` : undefined}
      />

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}





