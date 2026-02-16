"use server";

import { cookies } from "next/headers";
import connectDB from "@/app/lib/dbConnect";
import User from "@/app/lib/models/User";

/**
 * Get session from cookies (legacy) or from passed parameter (localStorage)
 * @param {Object} sessionData - Optional session data passed from client (from localStorage)
 * @returns {Object|null} Session object or null
 */
export async function getSession(sessionData = null) {
  // If session data is passed (from x-session header), validate against DB
  if (sessionData && sessionData.userId) {
    try {
      await connectDB();
      const user = await User.findById(sessionData.userId).select("username role").lean();
      if (!user) return null;
      return {
        userId: user._id.toString(),
        username: user.username,
        role: user.role,
      };
    } catch {
      return null;
    }
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
