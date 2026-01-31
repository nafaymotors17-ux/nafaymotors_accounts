"use client";

import { usePathname } from "next/navigation";
import TabNavigation from "./TabNavigation";

export default function ConditionalNavigation() {
  const pathname = usePathname();
  
  // Don't show navigation on login page or trip detail pages
  if (pathname === "/login" || (pathname?.startsWith("/carrier-trips/") && pathname !== "/carrier-trips")) {
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
