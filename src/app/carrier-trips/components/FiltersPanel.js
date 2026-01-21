"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";

export default function FiltersPanel({ companies, searchParams }) {
  const router = useRouter();
  const params = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const handleFilter = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newParams = new URLSearchParams();

    const startDate = formData.get("startDate");
    const endDate = formData.get("endDate");
    const company = formData.get("company");
    const customer = formData.get("customer");

    if (startDate) newParams.set("startDate", startDate);
    if (endDate) newParams.set("endDate", endDate);
    if (company) newParams.set("company", company);
    if (customer) newParams.set("customer", customer);

    router.push(`/carrier-trips?${newParams.toString()}`);
  };

  const clearFilters = () => {
    router.push("/carrier-trips");
  };

  const hasActiveFilters = params.get("startDate") || params.get("endDate") || 
                          params.get("company") || params.get("customer");

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Filters</h2>
        <div className="flex gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showFilters ? "Hide" : "Show"} Filters
          </button>
        </div>
      </div>

      {showFilters && (
        <form onSubmit={handleFilter} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              name="startDate"
              defaultValue={params.get("startDate") || ""}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              name="endDate"
              defaultValue={params.get("endDate") || ""}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company
            </label>
            <select
              name="company"
              defaultValue={params.get("company") || ""}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Companies</option>
              {companies.map((company) => (
                <option key={company._id} value={company.name}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer
            </label>
            <input
              type="text"
              name="customer"
              defaultValue={params.get("customer") || ""}
              placeholder="Search customer..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Apply Filters
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
