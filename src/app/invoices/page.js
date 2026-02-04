"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getInvoices } from "@/app/lib/invoice-actions/invoices";
import { getAllCompanies } from "@/app/lib/carriers-actions/companies";
import InvoicesTable from "./components/InvoicesTable";
import { RefreshCw } from "lucide-react";

export default function InvoicesPage() {
  // UI state only
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(""); // "paid", "unpaid", "partial", "overdue", ""
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const queryClient = useQueryClient();

  // Server data with React Query
  const {
    data: invoicesData,
    isLoading: invoicesLoading,
    error: invoicesError,
    refetch: refetchInvoices,
    isRefetching: isRefetchingInvoices,
  } = useQuery({
    queryKey: ["invoices", { page, limit, search: searchQuery, company: selectedCompany, paymentStatus }],
    queryFn: () =>
      getInvoices({
        page: page.toString(),
        limit: limit.toString(),
        search: searchQuery,
        company: selectedCompany,
        paymentStatus: paymentStatus || undefined,
      }),
  });

  const {
    data: companiesData,
    isLoading: companiesLoading,
    refetch: refetchCompanies,
    isRefetching: isRefetchingCompanies,
  } = useQuery({
    queryKey: ["companies"],
    queryFn: getAllCompanies,
  });

  const handleRefresh = () => {
    refetchInvoices();
    refetchCompanies();
    queryClient.invalidateQueries({ queryKey: ["company-balances"] });
  };

  const isRefreshing = isRefetchingInvoices || isRefetchingCompanies;

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    setPage(1); // Reset to page 1 on search
  };

  const handleCompanyChange = (value) => {
    setSelectedCompany(value);
    setPage(1);
  };

  const handlePaymentStatusChange = (value) => {
    setPaymentStatus(value);
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setPage(1); // Reset to page 1 when limit changes
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4 flex justify-end">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || invoicesLoading || companiesLoading}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          title="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>
      {invoicesError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">
            Error loading invoices: {invoicesError.message || invoicesData?.error || "Unknown error"}
          </p>
        </div>
      )}
      {invoicesData?.error && !invoicesError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">
            Error: {invoicesData.error}
          </p>
        </div>
      )}
      <InvoicesTable
        invoices={invoicesData?.invoices || []}
        pagination={invoicesData?.pagination}
        totals={invoicesData?.totals}
        companies={companiesData?.companies || []}
        loading={invoicesLoading || companiesLoading}
        searchQuery={searchQuery}
        selectedCompany={selectedCompany}
        paymentStatus={paymentStatus}
        onSearchChange={handleSearchChange}
        onCompanyChange={handleCompanyChange}
        onPaymentStatusChange={handlePaymentStatusChange}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
        currentLimit={limit}
      />
    </div>
  );
}
