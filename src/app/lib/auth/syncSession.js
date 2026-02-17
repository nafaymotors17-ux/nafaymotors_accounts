"use client";

// Sync localStorage session to cookies for server components
// This allows server components to access session via cookies
// while primary storage is localStorage

// Session duration: 24 hours
const SESSION_MAX_AGE_SEC = 60 * 60 * 24;

function getCookieOptions() {
  const isProduction = typeof window !== "undefined" && window.location?.protocol === "https:";
  const securePart = isProduction ? "; Secure" : "";
  return `path=/; max-age=${SESSION_MAX_AGE_SEC}; SameSite=Lax${securePart}`;
}

export function syncSessionToCookie() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const sessionData = localStorage.getItem("user_session");
    if (sessionData) {
      const pastDate = "Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = `user_session=; expires=${pastDate}; path=/`;

      const cookieValue = encodeURIComponent(sessionData);
      document.cookie = `user_session=${cookieValue}; ${getCookieOptions()}`;
    } else {
      clearSessionCookie();
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
    
  } catch (error) {
    console.error("Error clearing session cookie:", error);
  }
}
