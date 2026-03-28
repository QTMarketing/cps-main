"use client";

import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

export function TopNavbar() {
  const handleLogout = () => {
    // Clear auth token
    document.cookie = "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    // Redirect to login
    window.location.href = "/login";
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center">
        <h1 className="text-xl font-bold text-foreground">QT Office</h1>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <User className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Admin User</span>
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
            admin
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </header>
  );
}
