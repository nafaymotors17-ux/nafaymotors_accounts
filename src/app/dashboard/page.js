"use server";
import Link from "next/link";
import { getAccountsCount } from "../lib/accounting-actions/accounts";
export default async function Dashboard() {
  const totalAccounts = await getAccountsCount();
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">Accounts</h2>
          <span className="flex flex-row gap-2">
            <p>Total</p>
            <p className="text-gray-600">{totalAccounts}</p>
          </span>
          <Link
            href="/accounting"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            View Accounts
          </Link>
        </div>
      </div>
    </div>
  );
}
