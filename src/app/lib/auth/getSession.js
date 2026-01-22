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
    

    
    return session;
  } catch (error) {
   
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
  

  
  // Check for super_admin role (case-insensitive for safety)
  const userRole = session.role?.toLowerCase();
  const isSuperAdmin = userRole === "super_admin";
  
  if (!isSuperAdmin) {

    throw new Error("Forbidden: Super admin access required");
  }
  
  return session;
}
