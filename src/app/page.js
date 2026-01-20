// app/page.jsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard by default
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
