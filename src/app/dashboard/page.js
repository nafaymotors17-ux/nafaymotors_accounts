"use server";
import Link from "next/link";

export default async function Dashboard() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">Accounts</h2>
          <p className="text-gray-600">100</p>
          <Link
            href="/accounting"
            className="text-blue-600 hover:text-blue-700"
          >
            View Accounts
          </Link>
          <Link
            href="/accounting/create"
            className="text-blue-600 hover:text-blue-700"
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
