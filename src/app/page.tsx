"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Root page: redirects authenticated users to /write-checks,
 * unauthenticated users to /login.
 *
 * Previously this page contained a duplicated WriteChecksContent component
 * with hardcoded storeId / issuedBy IDs that no longer matched the schema.
 * The canonical write-checks UI lives at /write-checks/page.tsx.
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = document.cookie
      .split("; ")
      .find((row) => row.startsWith("auth-token="))
      ?.split("=")[1];

    if (token) {
      router.replace("/write-checks");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
    </div>
  );
}