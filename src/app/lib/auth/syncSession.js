"use client";

// Sync localStorage session to cookies for server components
// This allows server components to access session via cookies
// while primary storage is localStorage

export function syncSessionToCookie() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const sessionData = localStorage.getItem("user_session");
    if (sessionData) {
      // First, clear any existing cookie to avoid conflicts
      const pastDate = "Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = `user_session=; expires=${pastDate}; path=/`;
      
      // Then set the new cookie with session data for server components
      // Use SameSite=None and Secure for cross-site requests if needed
      // For localhost, SameSite=Lax should work fine
      const cookieValue = encodeURIComponent(sessionData);
      const cookieString = `user_session=${cookieValue}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      document.cookie = cookieString;
      
      // Verify the cookie was set
      const cookieSet = document.cookie.includes("user_session");
      console.log("[syncSessionToCookie] Cookie synced:", {
        hasData: !!sessionData,
        dataLength: sessionData.length,
        cookieSet: cookieSet,
        session: JSON.parse(sessionData)
      });
    } else {
      // If no session data, clear the cookie
      clearSessionCookie();
      console.warn("[syncSessionToCookie] No session data in localStorage, cookie cleared");
    }
  } catch (error) {
    console.error("Error syncing session to cookie:", error);
  }
}

export function clearSessionCookie() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    // Clear cookie with all possible variations to ensure it's removed
    const pastDate = "Thu, 01 Jan 1970 00:00:00 GMT";
    const paths = ["/", ""];
    const domains = [window.location.hostname, `.${window.location.hostname}`, ""];
    
    // Clear cookie for all path and domain combinations
    paths.forEach(path => {
      domains.forEach(domain => {
        const domainPart = domain ? `; domain=${domain}` : "";
        const pathPart = path ? `; path=${path}` : "";
        document.cookie = `user_session=; expires=${pastDate}${pathPart}${domainPart}`;
        document.cookie = `user_session=; expires=${pastDate}${pathPart}${domainPart}; SameSite=Lax`;
        document.cookie = `user_session=; expires=${pastDate}${pathPart}${domainPart}; SameSite=None; Secure`;
      });
    });
    
    console.log("[clearSessionCookie] Cookie cleared");
  } catch (error) {
    console.error("Error clearing session cookie:", error);
  }
}
