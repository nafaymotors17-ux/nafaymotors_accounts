"use client";

import { usePathname } from "next/navigation";

export default function ConditionalMain({ children }) {
  const pathname = usePathname();
  
  // Don't add top padding for login page, trip detail pages, or truck detail pages
  const isTripDetailPage = pathname?.startsWith("/carrier-trips/") && pathname !== "/carrier-trips";
  // Truck detail page is /carriers/[truckId] - exclude /carriers listing page
  const isTruckDetailPage = pathname?.startsWith("/carriers/") && pathname !== "/carriers";
  const shouldHavePadding = pathname !== "/login" && !isTripDetailPage && !isTruckDetailPage;

  return (
    <main className={`min-h-screen bg-gray-100 ${shouldHavePadding ? "pt-16" : ""}`}>
      {children}
    </main>
  );
}
