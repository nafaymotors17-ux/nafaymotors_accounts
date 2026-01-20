"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Plus, Download } from "lucide-react";
import { createCompany } from "@/app/lib/carriers-actions/companies";
import CompanyInvoiceGenerator from "./CompanyInvoiceGenerator";

export default function CompactFilters({ companies, carriers = [], isSuperAdmin = false }) {
  const router = useRouter();
  const params = useSearchParams();
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [showInvoiceGenerator, setShowInvoiceGenerator] = useState(false);

  const handleFilter = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newParams = new URLSearchParams();

    const startDate = formData.get("startDate");
    const endDate = formData.get("endDate");
    const company = formData.get("company");

    if (startDate) newParams.set("startDate", startDate);
    if (endDate) newParams.set("endDate", endDate);
    if (company) newParams.set("company", company);

    // Update URL and refresh data immediately
    const url = `/carriers?${newParams.toString()}`;
    await router.push(url);
    // Refresh to ensure server components re-fetch with new params
    router.refresh();
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      setError("Company name is required");
      return;
    }

    setIsCreating(true);
    setError("");
    const result = await createCompany(newCompanyName.trim());

    if (result.success) {
      setNewCompanyName("");
      setShowAddCompany(false);
      router.refresh();
    } else {
      setError(result.error || "Failed to create company");
    }
    setIsCreating(false);
  };

  const clearFilters = async () => {
    await router.push("/carriers");
    // Refresh to ensure server components re-fetch with cleared params
    router.refresh();
  };

  const hasActiveFilters =
    params.get("startDate") || params.get("endDate") || params.get("company");
  
  const selectedCompany = params.get("company") || "";
  const startDate = params.get("startDate") || "";
  const endDate = params.get("endDate") || "";
  
  // Show invoice button only when company and both dates are selected
  const canGenerateInvoice = selectedCompany && startDate && endDate;

  const handleGenerateInvoice = () => {
    if (!selectedCompany) {
      alert("Please select a company first");
      return;
    }
    if (!startDate || !endDate) {
      alert("Date range is required for generating invoices");
      return;
    }
    setShowInvoiceGenerator(true);
  };

  return (
    <>
    <div className="bg-white rounded-lg shadow-sm p-2 mb-3 border border-gray-200">
      <form onSubmit={handleFilter}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-medium text-gray-600 whitespace-nowrap">
              Date:
            </label>
            <input
              type="date"
              name="startDate"
              key={`startDate-${startDate}`}
              defaultValue={startDate}
              className="w-28 px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-gray-400 text-xs">-</span>
            <input
              type="date"
              name="endDate"
              key={`endDate-${endDate}`}
              defaultValue={endDate}
              className="w-28 px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-medium text-gray-600 whitespace-nowrap">
              Company:
            </label>
            <div className="flex gap-1">
              <select
                name="company"
                key={`company-${selectedCompany}`}
                defaultValue={selectedCompany}
                className="w-40 px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All</option>
                {companies.map((company) => (
                  <option key={company._id} value={company.name}>
                    {company.name}
                    {isSuperAdmin && company.user?.username ? ` (${company.user.username})` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowAddCompany(!showAddCompany)}
                className="px-1.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center"
                title="Add New Company"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex gap-1.5 ml-auto">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
            {canGenerateInvoice && (
              <button
                type="button"
                onClick={handleGenerateInvoice}
                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Invoice
              </button>
            )}
            <button
              type="submit"
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
            >
              <Search className="w-3 h-3" />
              Filter
            </button>
          </div>
        </div>
      </form>

      {/* Add Company Form */}
      {showAddCompany && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
          <form onSubmit={handleCreateCompany} className="flex gap-1.5">
            <div className="flex-1">
              <input
                type="text"
                value={newCompanyName}
                onChange={(e) => {
                  setNewCompanyName(e.target.value.toUpperCase());
                  setError("");
                }}
                placeholder="Company name"
                className="w-full px-2 py-1 text-xs border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
                disabled={isCreating}
              />
              {error && (
                <p className="text-[10px] text-red-600 mt-0.5">{error}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={isCreating || !newCompanyName.trim()}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isCreating ? "..." : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddCompany(false);
                setNewCompanyName("");
                setError("");
              }}
              className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              disabled={isCreating}
            >
              <X className="w-3 h-3" />
            </button>
          </form>
        </div>
      )}
    </div>

    {/* Invoice Generator Modal */}
    {showInvoiceGenerator && (
      <CompanyInvoiceGenerator
        companies={companies}
        initialCompany={selectedCompany ? companies.find(c => c.name === selectedCompany) : null}
        onClose={() => {
          setShowInvoiceGenerator(false);
        }}
      />
    )}
    </>
  );
}
