"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Download } from "lucide-react";
import { getCompanyBreakdown } from "@/app/lib/invoice-actions/invoices";
import { getAllCompanies } from "@/app/lib/carriers-actions/companies";
import * as XLSX from "xlsx";

export default function CompanyBreakdownTab() {
  // UI state for frontend filtering and pagination of COMPANY breakdown
  // Since companies are max 100-200, we do all filtering/pagination on frontend
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20); // Companies per page

  // Fetch company breakdown from separate API (returns aggregated company stats only)
  const {
    data: breakdownData,
    isLoading: breakdownLoading,
  } = useQuery({
    queryKey: ["companyBreakdown"],
    queryFn: getCompanyBreakdown,
  });

  const {
    data: companiesData,
    isLoading: companiesLoading,
  } = useQuery({
    queryKey: ["companies"],
    queryFn: getAllCompanies,
  });

  // Get company breakdown from API response (already aggregated on server)
  const allCompanyBreakdown = useMemo(() => {
    if (!breakdownData?.success || !breakdownData?.companies) return [];
    return breakdownData.companies;
  }, [breakdownData]);

  // Frontend filtering of COMPANY breakdown (not invoices)
  // Since we only have 100-200 companies max, filtering is fast on frontend
  const filteredCompanyBreakdown = useMemo(() => {
    let filtered = [...allCompanyBreakdown];

    // Filter by search query
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((company) =>
        company.companyName.toLowerCase().includes(searchLower)
      );
    }

    // Filter by selected company
    if (selectedCompany) {
      filtered = filtered.filter(
        (company) => company.companyName === selectedCompany
      );
    }

    // Filter by payment status
    if (paymentStatusFilter) {
      filtered = filtered.filter((company) => {
        if (paymentStatusFilter === "paid") {
          return company.paidInvoices > 0 && company.unpaidInvoices === 0 && company.partialInvoices === 0 && company.overdueInvoices === 0;
        } else if (paymentStatusFilter === "unpaid") {
          return company.unpaidInvoices > 0;
        } else if (paymentStatusFilter === "partial") {
          return company.partialInvoices > 0;
        } else if (paymentStatusFilter === "overdue") {
          return company.overdueInvoices > 0;
        }
        return true;
      });
    }

    return filtered;
  }, [allCompanyBreakdown, searchQuery, selectedCompany, paymentStatusFilter]);

  // Frontend pagination of COMPANY breakdown (not invoices)
  // Paginate the filtered companies, showing 20 per page
  const paginatedCompanyBreakdown = useMemo(() => {
    const start = (page - 1) * limit;
    const end = start + limit;
    return filteredCompanyBreakdown.slice(start, end);
  }, [filteredCompanyBreakdown, page, limit]);

  const pagination = useMemo(() => {
    const total = filteredCompanyBreakdown.length;
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }, [filteredCompanyBreakdown.length, page, limit]);

  // Get totals from API response (already calculated on server)
  // Or calculate from filtered results if filters are active
  const totals = useMemo(() => {
    // If no filters, use server-calculated totals
    if (!searchQuery && !selectedCompany && !paymentStatusFilter) {
      return breakdownData?.totals || {
        totalCompanies: 0,
        totalInvoices: 0,
        totalAmount: 0,
        totalPaid: 0,
        outstandingBalance: 0,
        paidInvoices: 0,
        unpaidInvoices: 0,
        partialInvoices: 0,
        overdueInvoices: 0,
      };
    }
    // If filters are active, calculate from filtered results
    return filteredCompanyBreakdown.reduce(
      (acc, company) => ({
        totalCompanies: acc.totalCompanies + 1,
        totalInvoices: acc.totalInvoices + company.totalInvoices,
        totalAmount: acc.totalAmount + company.totalAmount,
        totalPaid: acc.totalPaid + company.totalPaid,
        outstandingBalance: acc.outstandingBalance + company.outstandingBalance,
        paidInvoices: acc.paidInvoices + company.paidInvoices,
        unpaidInvoices: acc.unpaidInvoices + company.unpaidInvoices,
        partialInvoices: acc.partialInvoices + company.partialInvoices,
        overdueInvoices: acc.overdueInvoices + company.overdueInvoices,
      }),
      {
        totalCompanies: 0,
        totalInvoices: 0,
        totalAmount: 0,
        totalPaid: 0,
        outstandingBalance: 0,
        paidInvoices: 0,
        unpaidInvoices: 0,
        partialInvoices: 0,
        overdueInvoices: 0,
      }
    );
  }, [filteredCompanyBreakdown, breakdownData?.totals, searchQuery, selectedCompany, paymentStatusFilter]);

  const handleExportToExcel = useCallback(() => {
    const data = filteredCompanyBreakdown.map((company) => ({
      Company: company.companyName,
      "Total Invoices": company.totalInvoices,
      "Paid Invoices": company.paidInvoices,
      "Unpaid Invoices": company.unpaidInvoices,
      "Partial Invoices": company.partialInvoices,
      "Overdue Invoices": company.overdueInvoices,
      "Total Amount": company.totalAmount,
      "Total Paid": company.totalPaid,
      "Outstanding Balance": company.outstandingBalance,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Company Breakdown");
    XLSX.writeFile(wb, `Company_Breakdown_${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [filteredCompanyBreakdown]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCompany("");
    setPaymentStatusFilter("");
    setPage(1); // Reset to first page
  }, []);

  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    setPage(1); // Reset to first page on search
  }, []);

  const handleCompanyChange = useCallback((value) => {
    setSelectedCompany(value);
    setPage(1); // Reset to first page
  }, []);

  const handlePaymentStatusChange = useCallback((value) => {
    setPaymentStatusFilter(value);
    setPage(1); // Reset to first page
  }, []);

  const hasActiveFilters = useMemo(
    () => !!(searchQuery || selectedCompany || paymentStatusFilter),
    [searchQuery, selectedCompany, paymentStatusFilter]
  );

  if (breakdownLoading || companiesLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center text-gray-500">
          <p>Loading company breakdown...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Companies</p>
          <p className="text-2xl font-bold text-gray-800">{totals.totalCompanies}</p>
          <p className="text-xs text-gray-500 mt-1">
            {totals.totalInvoices} total invoices
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Outstanding</p>
          <p className="text-2xl font-bold text-red-600">
            R{totals.outstandingBalance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {totals.unpaidInvoices + totals.partialInvoices + totals.overdueInvoices} unpaid invoices
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Payment Status</p>
          <div className="flex gap-2 text-xs mt-2 flex-wrap">
            <span className="text-green-600">Paid: {totals.paidInvoices}</span>
            <span className="text-yellow-600">Partial: {totals.partialInvoices}</span>
            <span className="text-red-600">Unpaid: {totals.unpaidInvoices}</span>
            <span className="text-red-800">Overdue: {totals.overdueInvoices}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-3 border-b bg-gray-50">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search company..."
                className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => handleSearchChange("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="w-48">
              <select
                value={selectedCompany}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">All Companies</option>
                {(companiesData?.companies || []).map((company) => (
                  <option key={company._id} value={company.name}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-40">
              <select
                value={paymentStatusFilter}
                onChange={(e) => handlePaymentStatusChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">All Status</option>
                <option value="paid">Paid Only</option>
                <option value="partial">Partial Only</option>
                <option value="unpaid">Unpaid Only</option>
                <option value="overdue">Overdue Only</option>
              </select>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={handleExportToExcel}
              className="px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>
          </div>
        </div>

        {/* Company Breakdown Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Company Name
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Total Invoices
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Paid
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Unpaid
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Partial
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Overdue
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Total Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Total Paid
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Outstanding
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedCompanyBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    No companies found
                  </td>
                </tr>
              ) : (
                paginatedCompanyBreakdown.map((company) => (
                  <tr key={company.companyName} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {company.companyName}
                    </td>
                    <td className="px-6 py-4 text-sm text-center text-gray-600">
                      {company.totalInvoices}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                        {company.paidInvoices}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                        {company.unpaidInvoices}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                        {company.partialInvoices}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                        {company.overdueInvoices}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-green-600">
                      R{company.totalAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-blue-600">
                      R{company.totalPaid.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold">
                      <span
                        className={
                          company.outstandingBalance > 0
                            ? "text-red-600"
                            : "text-green-600"
                        }
                      >
                        R{company.outstandingBalance.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredCompanyBreakdown.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className="px-6 py-3 text-sm text-gray-900">TOTAL</td>
                  <td className="px-6 py-3 text-sm text-center text-gray-900">
                    {totals.totalInvoices}
                  </td>
                  <td className="px-6 py-3 text-sm text-center">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                      {totals.paidInvoices}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-center">
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                      {totals.unpaidInvoices}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-center">
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                      {totals.partialInvoices}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-center">
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                      {totals.overdueInvoices}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-green-600">
                    R{totals.totalAmount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-blue-600">
                    R{totals.totalPaid.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-red-600">
                    R{totals.outstandingBalance.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-sm text-gray-600">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total} companies
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(pagination.page - 1)}
                disabled={!pagination.hasPrevPage}
                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-sm text-gray-700">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(pagination.page + 1)}
                disabled={!pagination.hasNextPage}
                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
