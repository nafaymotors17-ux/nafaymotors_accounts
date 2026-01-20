"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSessionFromStorage, clearSessionFromStorage } from "@/app/lib/auth/sessionClient";
import { syncSessionToCookie, clearSessionCookie } from "@/app/lib/auth/syncSession";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Read session from localStorage
    const session = getSessionFromStorage();
    
    if (session) {
      setUser(session);
      // Sync to cookie for server components - do this on every route change
      // to ensure server components can access the session
      syncSessionToCookie();
      setLoading(false);
    } else {
      setUser(null);
      clearSessionCookie();
      setLoading(false);
      // Redirect to login if not on login page
      if (pathname !== "/login") {
        router.push("/login");
      }
    }
  }, [pathname, router]);

  // Also sync cookie whenever user state changes (e.g., after login)
  useEffect(() => {
    if (user) {
      syncSessionToCookie();
    }
  }, [user]);

  const logout = async () => {
    try {
      // Call server-side logout to clear cookie
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch (err) {
        console.warn("Server logout call failed, continuing with client-side logout:", err);
      }
      
      // Clear localStorage
      clearSessionFromStorage();
      // Clear cookie on client side as well
      clearSessionCookie();
      // Clear user state
      setUser(null);
      // Wait a bit to ensure everything is cleared
      await new Promise(resolve => setTimeout(resolve, 100));
      // Force a full page reload to clear any cached session data
      window.location.href = "/login";
    } catch (error) {
      console.error("Error logging out:", error);
      // Even if there's an error, try to navigate to login
      window.location.href = "/login";
    }
  };

  return (
    <UserContext.Provider value={{ user, loading, logout, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
}
