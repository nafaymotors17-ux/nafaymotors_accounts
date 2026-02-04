"use client";

import { usePathname } from "next/navigation";
import TabNavigation from "./TabNavigation";

export default function ConditionalNavigation() {
  const pathname = usePathname();
  
  // Don't show navigation on login page, trip detail pages, or truck detail pages
  const isTripDetailPage = pathname?.startsWith("/carrier-trips/") && pathname !== "/carrier-trips";
  // Truck detail page is /carriers/[truckId] - exclude /carriers listing page
  const isTruckDetailPage = pathname?.startsWith("/carriers/") && pathname !== "/carriers";
  
  if (pathname === "/login" || isTripDetailPage || isTruckDetailPage) {
    return null;
  }

  return (
    <nav className="bg-white border-b shadow-sm fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-4 py-2">
        <TabNavigation />
      </div>
    </nav>
  );
}
