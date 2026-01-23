"use client";

import { useState, useEffect, useRef } from "react";
import { getInvoices } from "@/app/lib/invoice-actions/invoices";
import { getAllCompanies } from "@/app/lib/carriers-actions/companies";
import InvoicesTable from "./components/InvoicesTable";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const fetchingRef = useRef(false);

  // Fetch companies once on mount
  useEffect(() => {
    async function loadCompanies() {
      try {
        const result = await getAllCompanies();
        setCompanies(result.companies || []);
      } catch (err) {
        console.error("Error loading companies:", err);
      }
    }
    loadCompanies();
  }, []);

  // Fetch invoices when search, company, or page changes - AUTO SEARCH
  useEffect(() => {
    if (fetchingRef.current) return;
    
    async function fetchData() {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        setLoading(true);
        const result = await getInvoices({
          page: page.toString(),
          limit: limit.toString(),
          search: searchQuery,
          company: selectedCompany,
        });

        setInvoices(result.invoices || []);
        setPagination(result.pagination);
      } catch (err) {
        console.error("Error fetching invoices:", err);
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    }

    fetchData();
  }, [searchQuery, selectedCompany, page, limit]);

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    setPage(1); // Reset to page 1 on search
    // Auto search happens immediately via useEffect above
  };

  const handleCompanyChange = (value) => {
    setSelectedCompany(value);
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
      <div className="mb-6">
      
      </div>

      <InvoicesTable 
        invoices={invoices} 
        pagination={pagination} 
        companies={companies}
        loading={loading}
        searchQuery={searchQuery}
        selectedCompany={selectedCompany}
        onSearchChange={handleSearchChange}
        onCompanyChange={handleCompanyChange}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
        currentLimit={limit}
      />
    </div>
  );
}
