"use client";

import { useEffect } from "react";

export function Toast({ message, type = "success", onDismiss, duration = 4000 }) {
  useEffect(() => {
    if (!message || !onDismiss) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [message, onDismiss, duration]);

  if (!message) return null;

  const isError = type === "error";
  return (
    <div
      className="fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm"
      style={{
        backgroundColor: isError ? "#fef2f2" : "#f0fdf4",
        color: isError ? "#b91c1c" : "#166534",
        border: `1px solid ${isError ? "#fecaca" : "#bbf7d0"}`,
      }}
      role="alert"
    >
      {message}
    </div>
  );
}
