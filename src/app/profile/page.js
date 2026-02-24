"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Profile is opened as a modal from the nav. Redirect direct /profile visits to dashboard. */
export default function ProfilePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center text-gray-500 text-sm">Redirecting...</div>
    </div>
  );
}
