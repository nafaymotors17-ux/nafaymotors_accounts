"use client";

import { usePathname } from "next/navigation";

export default function ConditionalMain({ children }) {
  const pathname = usePathname();
  
  // Don't add top padding for login page or trip detail pages
  const isTripDetailPage = pathname?.startsWith("/carrier-trips/") && pathname !== "/carrier-trips";
  const shouldHavePadding = pathname !== "/login" && !isTripDetailPage;

  return (
    <main className={`min-h-screen bg-gray-100 ${shouldHavePadding ? "pt-16" : ""}`}>
      {children}
    </main>
  );
}
