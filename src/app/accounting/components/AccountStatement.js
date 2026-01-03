"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getAccountTransactions } from "@/lib/accounting-actions/transaction";
import Link from "next/link";
import PrintButton from "./PrintButton";
import {
  X,
  Search,
  Calendar,
  Filter,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from "lucide-react";

export default function AccountStatement({ account, searchParams, onClose }) {
  const today = new Date().toISOString().split("T")[0];

  // Separate transaction filters from pagination state
  const [filters, setFilters] = useState({
    startDate: searchParams?.startDate || today,
    endDate: searchParams?.endDate || today,
    search: searchParams?.search || "",
    type: searchParams?.type || "all",
  });

  const [pagination, setPagination] = useState({
    page: parseInt(searchParams?.page || "1"),
    limit: parseInt(searchParams?.limit || "25"),
  });

  const [allTransactions, setAllTransactions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState(filters.search);

  // For cleanup of async calls
  const lastFetchId = useRef(0);

  // Helper for formatting currency compactly
  const money = (amount) =>
    Number(amount ?? 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  function formatDate(date) {
    return new Date(date).toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  // Fetch data when filters OR pagination changes
  useEffect(() => {
    let cancelled = false;
    let fetchId = ++lastFetchId.current;
    setLoading(true);

    const fetchAll = async () => {
      try {
        const [allData, data] = await Promise.all([
          getAccountTransactions(account.slug, {
            ...filters,
            ...pagination,
            page: 1,
            limit: 10000,
          }),
          getAccountTransactions(account.slug, {
            ...filters,
            ...pagination,
          }),
        ]);

        if (cancelled || fetchId !== lastFetchId.current) return;

        setAllTransactions(allData.transactions || []);
        setTransactions(data.transactions || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [
    account.slug,
    filters.startDate,
    filters.endDate,
    filters.search,
    filters.type,
    pagination.page,
    pagination.limit, // Add limit as dependency
  ]);

  // Debounced search effect
  useEffect(() => {
    if (searchInput === filters.search) return;

    const delayDebounceFn = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        search: searchInput,
      }));
      setPagination((prev) => ({
        ...prev,
        page: 1, // Reset to page 1 on search
      }));
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchInput, filters.search]);

  // Calculate stats, memoized for performance
  const stats = useMemo(() => {
    const startDate = new Date(filters.startDate);
    startDate.setHours(0, 0, 0, 0);

    let openingBalance = account.initialBalance ?? 0;
    let totalCredit = 0;
    let totalDebit = 0;

    const sortedAll = [...allTransactions].sort(
      (a, b) => new Date(a.transactionDate) - new Date(b.transactionDate)
    );

    sortedAll.forEach((t) => {
      const tDate = new Date(t.transactionDate);
      if (tDate < startDate) {
        openingBalance = openingBalance + (t.credit ?? 0) - (t.debit ?? 0);
      }
    });

    let balance = openingBalance;
    const balanceMap = new Map();

    sortedAll.forEach((t) => {
      const tDate = new Date(t.transactionDate);
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);

      if (tDate >= startDate && tDate <= endDate) {
        const credit = t.credit ?? 0;
        const debit = t.debit ?? 0;

        totalCredit += credit;
        totalDebit += debit;
        balance = balance + credit - debit;
        balanceMap.set(t._id.toString(), balance);
      }
    });

    const transactionsWithBalance = transactions.map((t) => ({
      ...t,
      runningBalance: balanceMap.get(t._id.toString()) ?? balance,
    }));

    return {
      openingBalance,
      closingBalance: balance,
      totalCredit,
      totalDebit,
      transactionsWithBalance,
    };
  }, [
    account.initialBalance,
    filters.startDate,
    filters.endDate,
    transactions,
    allTransactions,
  ]);

  // Generate page numbers with ellipsis
  const generatePageNumbers = () => {
    const currentPage = pagination.page;
    const pages = [];
    const totalPageCount = totalPages;

    // Always show first page
    pages.push(1);

    // Determine range around current page
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPageCount - 1, currentPage + 1);

    // Adjust if we're at the beginning
    if (currentPage <= 3) {
      endPage = Math.min(5, totalPageCount - 1);
    }

    // Adjust if we're at the end
    if (currentPage >= totalPageCount - 2) {
      startPage = Math.max(2, totalPageCount - 4);
    }

    // Add ellipsis after first page if needed
    if (startPage > 2) {
      pages.push("ellipsis-left");
    }

    // Add middle pages
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // Add ellipsis before last page if needed
    if (endPage < totalPageCount - 1) {
      pages.push("ellipsis-right");
    }

    // Always show last page if different from first page
    if (totalPageCount > 1) {
      pages.push(totalPageCount);
    }

    return pages;
  };

  // Building the URL to keep existing filters
  function buildUrl(newParams) {
    const params = new URLSearchParams();
    params.set("showStatement", "true");
    params.set("accountId", account._id);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    if (filters.search) params.set("search", filters.search);
    if (filters.type !== "all") params.set("type", filters.type);
    Object.entries(newParams || {}).forEach(([key, value]) => {
      if (value != null && value !== "") params.set(key, value);
    });
    return `/?${params.toString()}`;
  }

  // Submit handler for search/filter form
  function onFilterSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    setFilters((f) => ({
      ...f,
      startDate: fd.get("startDate"),
      endDate: fd.get("endDate"),
      search: fd.get("search"),
    }));
    setPagination((p) => ({ ...p, page: 1 }));
  }

  // Pagination handlers
  function gotoPage(page) {
    if (page >= 1 && page <= totalPages) {
      setPagination((p) => ({ ...p, page }));
    }
  }

  function handleLimitChange(limit) {
    setPagination((p) => ({ ...p, limit: parseInt(limit), page: 1 }));
  }

  const pageNumbers = generatePageNumbers();

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 md:p-4 overflow-hidden">
      <div className="bg-white w-full max-w-7xl h-full md:h-[95vh] flex flex-col rounded-lg shadow-2xl overflow-hidden text-sm">
        {/* 1. Header & Filters (Combined Row) */}
        <div className="bg-white border-b border-gray-200 p-2 flex flex-col md:flex-row gap-2 justify-between items-center shrink-0">
          <div className="flex items-center gap-2 pl-2">
            <h1 className="font-bold text-gray-800 text-base">
              {account.title}
            </h1>
            <span className="text-gray-400">|</span>
            <span className="text-gray-500 text-xs font-mono">
              {account.slug}
            </span>
          </div>

          <form
            onSubmit={onFilterSubmit}
            className="flex items-center gap-2 w-full md:w-auto"
          >
            <input type="hidden" name="showStatement" value="true" />
            <input type="hidden" name="accountId" value={account._id} />

            {/* Compact Date Range */}
            <div className="flex items-center border border-gray-300 rounded shadow-sm overflow-hidden h-8 bg-gray-50">
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, startDate: e.target.value }))
                }
                className="w-28 text-xs border-none bg-transparent focus:ring-0 px-2"
              />
              <span className="text-gray-400 text-[10px]">-</span>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, endDate: e.target.value }))
                }
                className="w-28 text-xs border-none bg-transparent focus:ring-0 px-2"
              />
            </div>

            {/* Compact Search */}
            <div className="relative h-8">
              <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                name="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search..."
                className="h-full pl-8 pr-3 w-32 md:w-48 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none shadow-sm"
              />
            </div>
            <button
              type="submit"
              className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded shadow-sm"
            >
              Filter
            </button>

            <div className="h-6 w-px bg-gray-300 mx-1"></div>

            <PrintButton
              filters={filters}
              account={account}
              allTransactions={allTransactions}
            />

            <button onClick={onClose}>
              <X className="w-5 h-5" />
            </button>
          </form>
        </div>

        {/* 2. Stat Strip (Very Compact) */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-around text-xs shrink-0">
          <div className="flex flex-col items-center">
            <span className="text-gray-500 uppercase tracking-wider text-[10px] font-semibold">
              Opening
            </span>
            <span className="font-mono font-medium text-gray-700">
              {account.currencySymbol}
              {money(stats.openingBalance)}
            </span>
          </div>
          <div className="h-6 w-px bg-gray-200"></div>
          <div className="flex flex-col items-center">
            <span className="text-green-600 uppercase tracking-wider text-[10px] font-semibold flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3" /> Credit
            </span>
            <span className="font-mono font-medium text-green-700">
              {money(stats.totalCredit)}
            </span>
          </div>
          <div className="h-6 w-px bg-gray-200"></div>
          <div className="flex flex-col items-center">
            <span className="text-red-600 uppercase tracking-wider text-[10px] font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" /> Debit
            </span>
            <span className="font-mono font-medium text-red-700">
              {money(stats.totalDebit)}
            </span>
          </div>
          <div className="h-6 w-px bg-gray-200"></div>
          <div className="flex flex-col items-center">
            <span className="text-gray-900 uppercase tracking-wider text-[10px] font-bold">
              Closing Balance
            </span>
            <span className="font-mono font-bold text-gray-900 bg-gray-200 px-2 rounded">
              {account.currencySymbol}
              {money(stats.closingBalance)}
            </span>
          </div>
        </div>

        {/* 3. Compact Table Area */}
        <div className="flex-1 overflow-auto bg-white relative">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Loading...
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-100 shadow-sm z-10 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                <tr>
                  <th className="py-2 px-3 border-b border-gray-200 w-32">
                    Date
                  </th>
                  <th className="py-2 px-3 border-b border-gray-200">
                    Description
                  </th>
                  <th className="py-2 px-3 border-b border-gray-200 w-28 text-right">
                    Credit
                  </th>
                  <th className="py-2 px-3 border-b border-gray-200 w-28 text-right">
                    Debit
                  </th>
                  <th className="py-2 px-3 border-b border-gray-200 w-28 text-right bg-gray-50">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs md:text-sm divide-y divide-gray-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-gray-400">
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  stats.transactionsWithBalance.map((t, idx) => (
                    <tr
                      key={t._id}
                      className={`hover:bg-blue-50/50 transition-colors ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                      }`}
                    >
                      <td className="py-1.5 px-3 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                        {formatDate(t.transactionDate)}
                      </td>
                      <td className="py-1.5 px-3 text-gray-800">
                        <div className="flex items-center gap-2">
                          <span>{t.details}</span>
                          {t.destination && (
                            <span className="text-[10px] text-gray-400 border px-1 rounded flex items-center">
                              <ArrowRight className="w-2 h-2 mr-1" />
                              {t.destination}
                            </span>
                          )}
                          {t.rateOfExchange && (
                            <span className="text-[10px] text-orange-400 bg-orange-50 px-1 rounded">
                              @{t.rateOfExchange}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-green-700">
                        {(t.credit ?? 0) > 0 ? money(t.credit) : ""}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-red-700">
                        {(t.debit ?? 0) > 0 ? money(t.debit) : ""}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-medium text-gray-700 bg-gray-50/50 border-l border-gray-100">
                        {money(t.runningBalance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* 4. Enhanced Pagination Footer */}
        <div className="border-t border-gray-200 bg-gray-50 p-2 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-3">
            {/* Records per page selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Show:</span>
              <select
                value={pagination.limit}
                onChange={(e) => handleLimitChange(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <span className="text-xs text-gray-600">records</span>
            </div>

            {/* Records info */}
            <div className="text-xs text-gray-500">
              Showing{" "}
              <span className="font-medium">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>
              -
              <span className="font-medium">
                {Math.min(pagination.page * pagination.limit, total)}
              </span>{" "}
              of <span className="font-medium">{total}</span> records
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              type="button"
              onClick={() => gotoPage(1)}
              disabled={pagination.page === 1}
              className={`h-7 w-7 flex items-center justify-center rounded border ${
                pagination.page === 1
                  ? "bg-gray-100 border-gray-200 text-gray-300 pointer-events-none"
                  : "bg-white border-gray-300 hover:bg-gray-100 text-gray-600"
              }`}
              aria-label="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Previous Page */}
            <button
              type="button"
              onClick={() => gotoPage(pagination.page - 1)}
              disabled={pagination.page === 1}
              className={`h-7 w-7 flex items-center justify-center rounded border ${
                pagination.page === 1
                  ? "bg-gray-100 border-gray-200 text-gray-300 pointer-events-none"
                  : "bg-white border-gray-300 hover:bg-gray-100 text-gray-600"
              }`}
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page Numbers with Ellipsis */}
            <div className="flex items-center gap-1 px-1">
              {pageNumbers.map((pageNum, index) => {
                if (
                  pageNum === "ellipsis-left" ||
                  pageNum === "ellipsis-right"
                ) {
                  return (
                    <span
                      key={`ellipsis-${index}`}
                      className="px-2 text-gray-400"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </span>
                  );
                }

                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => gotoPage(pageNum)}
                    className={`h-7 w-7 flex items-center justify-center rounded border text-xs ${
                      pagination.page === pageNum
                        ? "bg-blue-600 border-blue-600 text-white font-semibold"
                        : "bg-white border-gray-300 hover:bg-gray-100 text-gray-700"
                    }`}
                    aria-label={`Page ${pageNum}`}
                    aria-current={
                      pagination.page === pageNum ? "page" : undefined
                    }
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              type="button"
              onClick={() => gotoPage(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
              className={`h-7 w-7 flex items-center justify-center rounded border ${
                pagination.page >= totalPages
                  ? "bg-gray-100 border-gray-200 text-gray-300 pointer-events-none"
                  : "bg-white border-gray-300 hover:bg-gray-100 text-gray-600"
              }`}
              aria-label="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Last Page */}
            <button
              type="button"
              onClick={() => gotoPage(totalPages)}
              disabled={pagination.page >= totalPages}
              className={`h-7 w-7 flex items-center justify-center rounded border ${
                pagination.page >= totalPages
                  ? "bg-gray-100 border-gray-200 text-gray-300 pointer-events-none"
                  : "bg-white border-gray-300 hover:bg-gray-100 text-gray-600"
              }`}
              aria-label="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
