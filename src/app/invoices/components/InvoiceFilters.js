"use client";

import { Search, X } from "lucide-react";
import { useMemo } from "react";

export default function InvoiceFilters({
  searchQuery,
  selectedCompany,
  paymentStatus,
  companies,
  onSearchChange,
  onCompanyChange,
  onPaymentStatusChange,
  onClearFilters,
}) {
  const hasActiveFilters = useMemo(
    () => !!(searchQuery || selectedCompany || paymentStatus),
    [searchQuery, selectedCompany, paymentStatus]
  );

  return (
    <div className="p-2 border-b bg-gray-50">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by invoice number..."
            className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="w-48">
          <select
            value={selectedCompany}
            onChange={(e) => onCompanyChange(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">All Companies</option>
            {companies.map((company) => (
              <option key={company._id} value={company.name}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-40">
          <select
            value={paymentStatus}
            onChange={(e) => onPaymentStatusChange(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="px-2 py-1.5 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
