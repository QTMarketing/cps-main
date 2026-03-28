"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Shield, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Role =
  | "USER"
  | "STORE_USER"
  | "BACK_OFFICE"
  | "ADMIN"
  | "OFFICE_ADMIN"
  | "SUPER_ADMIN";

interface RoleSwitcherProps {
  userId: string | number;
  currentRole: Role;
  onRoleChange?: (newRole: Role) => void;
  disabled?: boolean;
  compact?: boolean; // For table display
}

export default function RoleSwitcher({
  userId,
  currentRole,
  onRoleChange,
  disabled = false,
  compact = false,
}: RoleSwitcherProps) {
  const [selectedRole, setSelectedRole] = useState<Role>(currentRole);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleRoleChange = async (newRole: Role) => {
    if (newRole === currentRole) {
      return; // No change needed
    }

    setIsUpdating(true);
    setMessage(null);

    try {
      // Get auth token from cookie
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("auth-token="))
        ?.split("=")[1];

      const response = await fetch(`/api/users/${userId}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to update role");
      }

      setSelectedRole(newRole);
      setMessage({
        type: "success",
        text: `Role updated to ${newRole}. User will need to log in again.`,
      });

      // Call callback if provided
      if (onRoleChange) {
        onRoleChange(newRole);
      }

      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to update role. Please try again.",
      });
      // Reset to current role on error
      setSelectedRole(currentRole);
    } finally {
      setIsUpdating(false);
    }
  };

  const getRoleBadgeVariant = (role: Role): "default" | "secondary" | "destructive" => {
    switch (role) {
      case "SUPER_ADMIN":
        return "destructive";
      case "ADMIN":
        return "default";
      case "BACK_OFFICE":
        return "secondary";
      case "USER":
        return "secondary";
    }
  };

  if (compact) {
    // Compact version for table display
    return (
      <div className="flex items-center gap-2">
        <Select
          value={selectedRole}
          onValueChange={(value) => handleRoleChange(value as Role)}
          disabled={disabled || isUpdating}
        >
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue>
              <Badge variant={getRoleBadgeVariant(selectedRole)}>
                {selectedRole}
              </Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USER">
              <Badge variant="secondary">USER</Badge>
            </SelectItem>
            <SelectItem value="STORE_USER">
              <Badge variant="secondary">STORE_USER</Badge>
            </SelectItem>
            <SelectItem value="BACK_OFFICE">
              <Badge variant="secondary">BACK_OFFICE</Badge>
            </SelectItem>
            <SelectItem value="OFFICE_ADMIN">
              <Badge variant="default">OFFICE_ADMIN</Badge>
            </SelectItem>
            <SelectItem value="ADMIN">
              <Badge variant="default">ADMIN</Badge>
            </SelectItem>
            <SelectItem value="SUPER_ADMIN">
              <Badge variant="destructive">SUPER_ADMIN</Badge>
            </SelectItem>
          </SelectContent>
        </Select>
        {isUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
        {message && (
          <div className="text-xs">
            {message.type === "success" ? (
              <CheckCircle className="h-3 w-3 text-green-500" />
            ) : (
              <AlertCircle className="h-3 w-3 text-red-500" />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <label className="text-sm font-medium">Role</label>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={selectedRole}
          onValueChange={(value) => handleRoleChange(value as Role)}
          disabled={disabled || isUpdating}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue>
              <div className="flex items-center gap-2">
                <Badge variant={getRoleBadgeVariant(selectedRole)}>
                  {selectedRole}
                </Badge>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USER">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">USER</Badge>
                <span className="text-xs text-muted-foreground">
                  Basic access
                </span>
              </div>
            </SelectItem>
            <SelectItem value="STORE_USER">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">STORE_USER</Badge>
                <span className="text-xs text-muted-foreground">
                  Store-scoped checks
                </span>
              </div>
            </SelectItem>
            <SelectItem value="BACK_OFFICE">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">BACK_OFFICE</Badge>
                <span className="text-xs text-muted-foreground">
                  Reports (view-only)
                </span>
              </div>
            </SelectItem>
            <SelectItem value="OFFICE_ADMIN">
              <div className="flex items-center gap-2">
                <Badge variant="default">OFFICE_ADMIN</Badge>
                <span className="text-xs text-muted-foreground">
                  Reports + checks (all stores)
                </span>
              </div>
            </SelectItem>
            <SelectItem value="ADMIN">
              <div className="flex items-center gap-2">
                <Badge variant="default">ADMIN</Badge>
                <span className="text-xs text-muted-foreground">
                  Management access
                </span>
              </div>
            </SelectItem>
            <SelectItem value="SUPER_ADMIN">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">SUPER_ADMIN</Badge>
                <span className="text-xs text-muted-foreground">
                  Full access
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>
      {message && (
        <Alert
          variant={message.type === "error" ? "destructive" : "default"}
          className="mt-2"
        >
          {message.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

