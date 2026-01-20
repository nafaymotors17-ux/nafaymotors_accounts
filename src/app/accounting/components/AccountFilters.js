"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AccountFilters({ accounts = [], pagination }) {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const [search, setSearch] = useState(urlSearchParams.get("search") || "");
  const [currency, setCurrency] = useState(urlSearchParams.get("currency") || "all");

  // Get unique currencies from accounts
  const currencies = Array.from(new Set(accounts.map((acc) => acc.currency).filter(Boolean))).sort();

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

  const clearFilters = () => {
    setSearch("");
    setCurrency("all");
    router.push("/accounting");
  };


  return (
    <>
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

    </>
  );
}
