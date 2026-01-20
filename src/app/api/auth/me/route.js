"use server";

import { getSession } from "@/app/lib/auth/getSession";

export async function GET(request) {
  try {
    // Try to get session from request headers (if passed from client)
    const sessionHeader = request.headers.get("x-session");
    let session = null;
    
    if (sessionHeader) {
      try {
        session = JSON.parse(sessionHeader);
      } catch (e) {
        // Invalid session header, fallback to cookies
      }
    }
    
    // Get session (from parameter or cookies)
    session = await getSession(session);
    
    if (!session) {
      return Response.json({ success: false, user: null }, { status: 401 });
    }

    return Response.json({ success: true, user: session });
  } catch (error) {
    console.error("Error getting user session:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
