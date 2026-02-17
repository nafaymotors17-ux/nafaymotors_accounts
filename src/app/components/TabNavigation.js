"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { getEnabledModules } from "../modules.config";
import { useUser } from "./UserContext";
import { syncSessionToCookie } from "@/app/lib/auth/syncSession";
import { LogOut, User } from "lucide-react";

export default function TabNavigation() {
  const pathname = usePathname();
  const enabledModules = getEnabledModules();
  const { user, loading, logout } = useUser();

  // Ensure cookie is synced on every route change for server components
  useEffect(() => {
    if (user) {
      syncSessionToCookie();
    }
  }, [user, pathname]);

  // Don't show navigation on login page or trip detail pages
  if (pathname === "/login" || (pathname?.startsWith("/carrier-trips/") && pathname !== "/carrier-trips")) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex gap-1 border-b border-gray-200 bg-white">
        <div className="px-3 py-2 text-xs text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Filter modules based on user role
  const filteredModules = enabledModules.filter((module) => {
    // Only super admin can see accounting
    if (module.id === "accounting") {
      return user?.role === "super_admin";
    }
    return true;
  });

  return (
    <div className="flex justify-between items-center">
      <div className="flex gap-0.5 border-b border-gray-200 bg-white">
        {filteredModules.map((module) => {
          const isActive = pathname === module.path || pathname.startsWith(module.path + '/');
          
          return (
            <Link
              key={module.id}
              href={module.path}
              onClick={() => {
                // Ensure cookie is synced before navigation for server components
                if (user) {
                  syncSessionToCookie();
                }
              }}
              className={`
                px-3 py-2 text-xs font-medium transition-colors
                ${
                  isActive
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }
              `}
            >
              <span className="mr-1">{module.icon}</span>
              {module.name}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-3 px-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <User className="w-3.5 h-3.5" />
          <span className="font-medium">{user.username}</span>
          {user.role === "super_admin" && (
            <span className="text-[10px] text-purple-600 font-medium">(Admin)</span>
          )}
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </button>
      </div>
    </div>
  );
}
