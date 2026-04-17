"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import {
  FileText,
  BarChart3,
  UserPlus,
  Building2,
  PlusCircle,
  TestTube,
  Loader2
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Write Checks", href: "/write-checks", icon: FileText, roles: ["USER", "STORE_USER", "ADMIN", "OFFICE_ADMIN", "SUPER_ADMIN"] },
  { name: "Reports", href: "/reports", icon: BarChart3, roles: ["STORE_USER", "ADMIN", "OFFICE_ADMIN", "SUPER_ADMIN", "BACK_OFFICE"] },
  { name: "Add Vendor", href: "/add-vendor", icon: UserPlus, roles: ["SUPER_ADMIN"] },
  { name: "Add User", href: "/add-user", icon: PlusCircle, roles: ["SUPER_ADMIN"] },
  { name: "Add Bank", href: "/banks/add", icon: Building2, roles: ["SUPER_ADMIN"] },
  { name: "Cheque Test", href: "/admin/cheque-test", icon: TestTube, roles: ["SUPER_ADMIN"] },
];

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load session");
  return res.json();
};

export function Sidebar() {
  const pathname = usePathname();
  const { data, error, isLoading } = useSWR("/api/auth/session", fetcher);

  return (
    <div className="w-64 bg-gray-900 text-white h-full">
      <div className="p-6 border-b border-gray-700">
        <h2 className="text-lg font-semibold">QT Office</h2>
      </div>
      <nav className="p-4 space-y-2">
        {/* Loading state - prevent partial render */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-300 p-3 bg-red-500/10 rounded-md">
            Failed to load navigation
          </div>
        ) : !data?.user?.role ? (
          <div className="text-sm text-gray-400 p-3">
            No session found
          </div>
        ) : (
          NAV_ITEMS.filter(i => i.roles.includes(data.user.role)).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:text-white hover:bg-gray-700"
                }`}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            );
          })
        )}
      </nav>
    </div>
  );
}