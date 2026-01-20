"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/app/components/UserContext";
import { syncSessionToCookie } from "@/app/lib/auth/syncSession";
import AccountsTable from "./AccountsTable";

export default function AccountingPageWrapper({ accounts: initialAccounts, pagination: initialPagination }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useUser();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [currency, setCurrency] = useState(searchParams.get("currency") || "all");

  useEffect(() => {
    // Ensure cookie is synced for server components
    if (user) {
      syncSessionToCookie();
    }
  }, [user]);

  // Check if user is super admin
  useEffect(() => {
    if (!loading && (!user || user.role !== "super_admin")) {
      console.log("[AccountingPageWrapper] Redirecting - user:", user?.role);
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (currency && currency !== "all") params.set("currency", currency);
    params.set("page", "1");
    router.push(`/accounting?${params.toString()}`);
  };

  const handleCurrencyChange = (e) => {
    const newCurrency = e.target.value;
    setCurrency(newCurrency);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (newCurrency && newCurrency !== "all") params.set("currency", newCurrency);
    params.set("page", "1");
    router.push(`/accounting?${params.toString()}`);
  };

  const handlePageChange = (newPage) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (currency && currency !== "all") params.set("currency", currency);
    params.set("page", newPage.toString());
    router.push(`/accounting?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearch("");
    setCurrency("all");
    router.push("/accounting");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user || user.role !== "super_admin") {
    return null; // Will redirect
  }

  const accounts = initialAccounts || [];
  const pagination = initialPagination || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  };

  // Get unique currencies from accounts
  const currencies = Array.from(new Set(accounts.map((acc) => acc.currency))).sort();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Accounts</h1>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <form onSubmit={handleSearch} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title or slug..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={handleCurrencyChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Currencies</option>
                {currencies.map((curr) => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Search
            </button>
            {(search || (currency && currency !== "all")) && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {/* Accounts Table */}
        <AccountsTable accounts={accounts} />

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-700">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total} accounts
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(1)}
                disabled={!pagination.hasPrevPage}
                className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                First
              </button>
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={!pagination.hasPrevPage}
                className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-700">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={!pagination.hasNextPage}
                className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
              <button
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={!pagination.hasNextPage}
                className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
