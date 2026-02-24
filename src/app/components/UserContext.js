"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSessionFromStorage, clearSessionFromStorage, setSessionInStorage } from "@/app/lib/auth/sessionClient";
import { syncSessionToCookie, clearSessionCookie } from "@/app/lib/auth/syncSession";
import { getCurrentUser } from "@/app/lib/users-actions/users";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [fullUserData, setFullUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Sync session cookie before child useEffects - useLayoutEffect runs before
  // React Query fetches, fixing intermittent 401 on direct navigation (Vercel)
  useLayoutEffect(() => {
    const session = getSessionFromStorage();
    if (session) {
      syncSessionToCookie();
    }
    // Do NOT clear cookie when localStorage is empty - server may still have valid cookie (Vercel fix)
  }, [pathname]);

  const refetchUser = async () => {
    try {
      const userResult = await getCurrentUser();
      if (userResult.success && userResult.user) {
        setFullUserData(userResult.user);
      }
    } catch (err) {
      console.error("Error fetching full user data:", err);
    }
  };

  useEffect(() => {
    const session = getSessionFromStorage();

    if (session) {
      setUser(session);
      syncSessionToCookie();
      const fetchFullUserData = async () => {
        try {
          const userResult = await getCurrentUser();
          if (userResult.success && userResult.user) {
            setFullUserData(userResult.user);
          }
        } catch (err) {
          console.error("Error fetching full user data:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchFullUserData();
      return;
    }

    // localStorage empty: check if server has valid session (cookie) - fixes Vercel "session expires too soon"
    const restoreFromCookie = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await res.json();
        if (res.ok && data.user) {
          setSessionInStorage(data.user);
          syncSessionToCookie();
          setUser(data.user);
          const userResult = await getCurrentUser();
          if (userResult.success && userResult.user) setFullUserData(userResult.user);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("Error restoring session from cookie:", err);
      }
      setUser(null);
      setFullUserData(null);
      clearSessionCookie();
      setLoading(false);
      if (pathname !== "/login") {
        router.push("/login");
      }
    };

    restoreFromCookie();
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
    <UserContext.Provider value={{ user, fullUserData, loading, logout, setUser, refetchUser }}>
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
