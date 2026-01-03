// app/page.jsx
"use client";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  const handleCreateAccount = () => {
    // You'll need to navigate to accounting page and show modal
    // This will be handled differently now
    router.push("/accounting");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">Accounts</h2>
          <p className="text-gray-600">100</p>
          <button
            onClick={() => router.push("/accounting")}
            className="block text-blue-600 hover:text-blue-700 mb-1"
          >
            View Accounts
          </button>
          <button
            onClick={handleCreateAccount}
            className="block text-blue-600 hover:text-blue-700"
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}
