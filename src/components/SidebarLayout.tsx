"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { UserInfo } from "@/components/UserInfo";
import { Loader2 } from "lucide-react";

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    setMounted(true);
  }, []);

  // For login page, render without sidebar
  if (isLoginPage) {
    return <>{children}</>;
  }

  // For all other pages, render with top navbar only (no sidebar)
  return (
    <>
      {/* Main Content Area with Top Navbar */}
      <div className="min-h-screen bg-background">
        {/* Top Navbar */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex h-16 items-center justify-between px-6">
            <div className="flex items-center space-x-6">
              <h1 className="text-lg font-semibold text-foreground">QT Office</h1>
              <nav className="flex items-center gap-4 text-sm overflow-x-auto">
                {/* Loading state - prevent partial render */}
                {!mounted || isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs">Loading...</span>
                  </div>
                ) : user?.role === "BACK_OFFICE" ? (
                  <a
                    href="/reports"
                    aria-current={pathname === "/reports" ? "page" : undefined}
                    className={`${pathname === "/reports" ? "text-foreground font-medium border-b-2 border-primary" : "text-foreground/80 hover:text-foreground"} transition-colors pb-1 whitespace-nowrap`}
                  >
                    Reports
                  </a>
                ) : (
                  <>
                    <a
                      href="/write-checks"
                      aria-current={pathname === "/write-checks" ? "page" : undefined}
                      className={`${pathname === "/write-checks" ? "text-foreground font-medium border-b-2 border-primary" : "text-foreground/80 hover:text-foreground"} transition-colors pb-1`}
                    >
                      Write Checks
                    </a>

                    {user?.role === "STORE_USER" || user?.role === "ADMIN" || user?.role === "OFFICE_ADMIN" || user?.role === "SUPER_ADMIN" ? (
                      <>
                        <a
                          href="/reports"
                          aria-current={pathname === "/reports" ? "page" : undefined}
                          className={`${pathname === "/reports" ? "text-foreground font-medium border-b-2 border-primary" : "text-foreground/80 hover:text-foreground"} transition-colors pb-1 whitespace-nowrap`}
                        >
                          Reports
                        </a>
                        {user?.role === "SUPER_ADMIN" && (
                          <a
                            href="/banks/manage"
                            aria-current={pathname === "/banks/manage" ? "page" : undefined}
                            className={`${pathname === "/banks/manage" ? "text-foreground font-medium border-b-2 border-primary" : "text-foreground/80 hover:text-foreground"} transition-colors pb-1 whitespace-nowrap`}
                          >
                            Banks
                          </a>
                        )}
                        {user?.role === "SUPER_ADMIN" && (
                          <a
                            href="/stores/manage"
                            aria-current={pathname === "/stores/manage" ? "page" : undefined}
                            className={`${pathname === "/stores/manage" ? "text-foreground font-medium border-b-2 border-primary" : "text-foreground/80 hover:text-foreground"} transition-colors pb-1 whitespace-nowrap`}
                          >
                            Stores
                          </a>
                        )}
                        {(user?.role === "ADMIN" || user?.role === "OFFICE_ADMIN" || user?.role === "SUPER_ADMIN") && (
                          <a
                            href="/vendors"
                            aria-current={pathname === "/vendors" ? "page" : undefined}
                            className={`${pathname === "/vendors" ? "text-foreground font-medium border-b-2 border-primary" : "text-foreground/80 hover:text-foreground"} transition-colors pb-1 whitespace-nowrap`}
                          >
                            Vendors
                          </a>
                        )}
                        {user?.role === "SUPER_ADMIN" && (
                          <a
                            href="/user-management"
                            aria-current={pathname === "/user-management" ? "page" : undefined}
                            className={`${pathname === "/user-management" ? "text-foreground font-medium border-b-2 border-primary" : "text-foreground/80 hover:text-foreground"} transition-colors pb-1 whitespace-nowrap`}
                          >
                            Users
                          </a>
                        )}
                      </>
                    ) : null}
                  </>
                )}
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <UserInfo />
            </div>
          </div>
        </div>
        
        <main className="p-6">
          {children}
        </main>
      </div>
    </>
  );
}

