"use server";

import { cookies } from "next/headers";

/**
 * Get session from cookies (legacy) or from passed parameter (localStorage)
 * @param {Object} sessionData - Optional session data passed from client (from localStorage)
 * @returns {Object|null} Session object or null
 */
export async function getSession(sessionData = null) {
  // If session data is passed (from localStorage), use it
  if (sessionData) {
    return sessionData;
  }

  // Fallback to cookies for backward compatibility
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("user_session");

    if (!sessionCookie) {
      console.log("[getSession] No session cookie found");
      return null;
    }

    // Decode URL-encoded cookie value
    let decodedValue;
    try {
      decodedValue = decodeURIComponent(sessionCookie.value);
    } catch (e) {
      // If decode fails, try using the value directly (might not be encoded)
      decodedValue = sessionCookie.value;
    }
    
    const session = JSON.parse(decodedValue);
    
    console.log("[getSession] Session retrieved from cookie:", {
      userId: session.userId,
      username: session.username,
      role: session.role,
      hasRole: !!session.role,
      rawCookieLength: sessionCookie.value.length
    });
    
    return session;
  } catch (error) {
    console.error("[getSession] Error parsing session cookie:", error);
    return null;
  }
}

export async function requireAuth() {
  const session = await getSession();
  
  if (!session) {
    throw new Error("Unauthorized");
  }
  
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireAuth();
  
  console.log("[requireSuperAdmin] Session check:", {
    userId: session.userId,
    username: session.username,
    role: session.role,
    roleType: typeof session.role,
    isSuperAdmin: session.role === "super_admin"
  });
  
  // Check for super_admin role (case-insensitive for safety)
  const userRole = session.role?.toLowerCase();
  const isSuperAdmin = userRole === "super_admin";
  
  if (!isSuperAdmin) {
    console.error("[requireSuperAdmin] Access denied:", {
      username: session.username,
      role: session.role,
      expected: "super_admin",
      received: session.role
    });
    throw new Error("Forbidden: Super admin access required");
  }
  
  return session;
}
