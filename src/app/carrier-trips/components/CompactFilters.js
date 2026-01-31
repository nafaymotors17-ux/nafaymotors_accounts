"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, X, Plus, Download } from "lucide-react";
import { createCompany } from "@/app/lib/carriers-actions/companies";
import CompanyInvoiceGenerator from "./CompanyInvoiceGenerator";

export default function CompactFilters({ companies, carriers = [], isSuperAdmin = false, users = [], selectedTripIds = [] }) {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  
  // UI state only
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [showInvoiceGenerator, setShowInvoiceGenerator] = useState(false);

  // Mutation for creating company
  const createCompanyMutation = useMutation({
    mutationFn: (name) => createCompany(name.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setNewCompanyName("");
      setShowAddCompany(false);
    },
  });

  const handleFilter = useCallback(async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newParams = new URLSearchParams();

    const startDate = formData.get("startDate");
    const endDate = formData.get("endDate");
    const company = formData.get("company");
    const carrierName = formData.get("carrierName");
    const tripNumber = formData.get("tripNumber");
    const isActive = formData.get("isActive");
    const userId = formData.get("userId");
    const globalSearch = formData.get("globalSearch");

    if (startDate) newParams.set("startDate", startDate);
    if (endDate) newParams.set("endDate", endDate);
    if (company) newParams.set("company", company);
    if (carrierName) newParams.set("carrierName", carrierName);
    if (tripNumber) newParams.set("tripNumber", tripNumber);
    if (isActive) newParams.set("isActive", isActive);
    if (userId && isSuperAdmin) newParams.set("userId", userId);
    if (globalSearch) newParams.set("globalSearch", globalSearch);

    // Update URL - React Query will automatically refetch
    const url = `/carrier-trips?${newParams.toString()}`;
    router.push(url);
  }, [router, isSuperAdmin]);

  const handleCreateCompany = useCallback((e) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      return;
    }
    createCompanyMutation.mutate(newCompanyName);
  }, [newCompanyName, createCompanyMutation]);

  const clearFilters = useCallback(() => {
    router.push("/carrier-trips");
  }, [router]);

  // Derived values with useMemo
  const hasActiveFilters = useMemo(() => 
    !!(params.get("startDate") || params.get("endDate") || params.get("company") || 
       params.get("carrierName") || params.get("tripNumber") || params.get("isActive") || 
       params.get("userId") || params.get("globalSearch")),
    [params]
  );
  
  const selectedCompany = useMemo(() => params.get("company") || "", [params]);
  const selectedCarrierName = useMemo(() => params.get("carrierName") || "", [params]);
  const selectedTripNumber = useMemo(() => params.get("tripNumber") || "", [params]);
  const startDate = useMemo(() => params.get("startDate") || "", [params]);
  const endDate = useMemo(() => params.get("endDate") || "", [params]);
  const selectedIsActive = useMemo(() => params.get("isActive") || "", [params]);
  const selectedUserId = useMemo(() => params.get("userId") || "", [params]);
  const globalSearchValue = useMemo(() => params.get("globalSearch") || "", [params]);
  
  // Show invoice button only when company and both dates are selected
  const canGenerateInvoice = useMemo(
    () => !!(selectedCompany && startDate && endDate),
    [selectedCompany, startDate, endDate]
  );

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

          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-medium text-gray-600 whitespace-nowrap">
              Carrier:
            </label>
            <input
              type="text"
              name="carrierName"
              key={`carrierName-${selectedCarrierName}`}
              defaultValue={selectedCarrierName}
              placeholder="Search carrier..."
              className="w-32 px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-medium text-gray-600 whitespace-nowrap">
              Trip #:
            </label>
            <input
              type="text"
              name="tripNumber"
              key={`tripNumber-${selectedTripNumber}`}
              defaultValue={selectedTripNumber}
              placeholder="Trip # (comma-separated)"
              className="w-32 px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              title="Enter trip numbers separated by commas (e.g., TRIP-001, TRIP-002, TRIP-003)"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-medium text-gray-600 whitespace-nowrap">
              Search:
            </label>
            <input
              type="text"
              name="globalSearch"
              key={`globalSearch-${globalSearchValue}`}
              defaultValue={globalSearchValue}
              placeholder="Search all fields..."
              className="w-40 px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-medium text-gray-600 whitespace-nowrap">
              Status:
            </label>
            <select
              name="isActive"
              key={`isActive-${selectedIsActive}`}
              defaultValue={selectedIsActive}
              className="w-28 px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          {isSuperAdmin && users.length > 0 && (
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-medium text-gray-600 whitespace-nowrap">
                User:
              </label>
              <select
                name="userId"
                key={`userId-${selectedUserId}`}
                defaultValue={selectedUserId}
                className="w-32 px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Users</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.username}
                  </option>
                ))}
              </select>
            </div>
          )}

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
                }}
                placeholder="Company name"
                className="w-full px-2 py-1 text-xs border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
                disabled={createCompanyMutation.isPending}
              />
              {createCompanyMutation.isError && (
                <p className="text-[10px] text-red-600 mt-0.5">
                  {createCompanyMutation.error?.error || "Failed to create company"}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={createCompanyMutation.isPending || !newCompanyName.trim()}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {createCompanyMutation.isPending ? "..." : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddCompany(false);
                setNewCompanyName("");
              }}
              className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              disabled={createCompanyMutation.isPending}
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
        selectedTripIds={selectedTripIds}
        onClose={() => {
          setShowInvoiceGenerator(false);
        }}
      />
    )}
    </>
  );
}
