"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getInvoices } from "@/app/lib/invoice-actions/invoices";
import { getAllCompanies } from "@/app/lib/carriers-actions/companies";
import InvoicesTable from "./components/InvoicesTable";

export default function InvoicesPage() {
  // UI state only
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(""); // "paid", "unpaid", "partial", "overdue", ""
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Server data with React Query
  const {
    data: invoicesData,
    isLoading: invoicesLoading,
    error: invoicesError,
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
  } = useQuery({
    queryKey: ["companies"],
    queryFn: getAllCompanies,
  });

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
      <InvoicesTable
        invoices={invoicesData?.invoices || []}
        pagination={invoicesData?.pagination}
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
