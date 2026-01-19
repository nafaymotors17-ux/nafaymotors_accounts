"use client";
import React from "react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { getAccountTransactions } from "@/app/lib/accounting-actions/transaction";
import PrintButton from "./PrintButton";
import {
  X,
  Search,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from "lucide-react";

// Memoized helper functions outside component
const money = (amount) =>
  Number(amount ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (date) => {
  return new Date(date).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

// Memoized table row component
const TransactionRow = React.memo(({ t, idx }) => (
  <tr
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
));

TransactionRow.displayName = "TransactionRow";

// Memoized pagination button components
const PaginationButton = React.memo(
  ({ onClick, disabled, children, className, ariaLabel }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  )
);

PaginationButton.displayName = "PaginationButton";

export default function AccountStatement({ account, searchParams, onClose }) {
  const today = new Date().toISOString().split("T")[0];

  // Use ref for stable initial values
  const initialParams = useRef({
    startDate: searchParams?.startDate || today,
    endDate: searchParams?.endDate || today,
    search: searchParams?.search || "",
    type: searchParams?.type || "all",
    page: parseInt(searchParams?.page || "1"),
    limit: parseInt(searchParams?.limit || "25"),
  });

  // Combine filters and pagination into single state to prevent partial updates
  const [state, setState] = useState({
    filters: {
      startDate: initialParams.current.startDate,
      endDate: initialParams.current.endDate,
      search: initialParams.current.search,
      type: initialParams.current.type,
    },
    pagination: {
      page: initialParams.current.page,
      limit: initialParams.current.limit,
    },
  });

  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Use ref for debounced search to avoid useEffect dependencies
  const searchInputRef = useRef(initialParams.current.search);
  const debounceTimeoutRef = useRef(null);

  // For cleanup of async calls
  const lastFetchId = useRef(0);

  // Memoized account data to prevent recalculations
  const memoizedAccount = useMemo(
    () => ({
      slug: account.slug,
      initialBalance: account.initialBalance,
      currencySymbol: account.currencySymbol,
      title: account.title,
      _id: account._id,
    }),
    [
      account.slug,
      account.initialBalance,
      account.currencySymbol,
      account.title,
      account._id,
    ]
  );

  // Stable fetch function wrapped in useCallback
  const fetchTransactions = useCallback(
    async (filters, pagination) => {
      let cancelled = false;
      let fetchId = ++lastFetchId.current;

      try {
        const data = await getAccountTransactions(memoizedAccount.slug, {
          ...filters,
          ...pagination,
        });

        if (cancelled || fetchId !== lastFetchId.current) return;

        setTransactions(data.transactions || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } finally {
        if (!cancelled) setLoading(false);
      }

      return () => {
        cancelled = true;
      };
    },
    [memoizedAccount.slug]
  );

  // Optimized useEffect with proper dependencies
  useEffect(() => {
    setLoading(true);
    fetchTransactions(state.filters, state.pagination);
  }, [
    state.filters.startDate,
    state.filters.endDate,
    state.filters.search,
    state.filters.type,
    state.pagination.page,
    state.pagination.limit,
    fetchTransactions, // Stable due to useCallback
  ]);

  // Handle search input changes with ref-based debouncing
  const handleSearchChange = useCallback((value) => {
    searchInputRef.current = value;

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        filters: {
          ...prev.filters,
          search: searchInputRef.current,
        },
        pagination: {
          ...prev.pagination,
          page: 1,
        },
      }));
    }, 500);
  }, []);

  // Calculate stats with proper memoization
  const stats = useMemo(() => {
    const startDate = new Date(state.filters.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(state.filters.endDate);
    endDate.setHours(23, 59, 59, 999);

    let openingBalance = memoizedAccount.initialBalance ?? 0;
    let totalCredit = 0;
    let totalDebit = 0;

    // Create a sorted copy of transactions once
    const sortedTransactions = [...transactions].sort(
      (a, b) => new Date(a.transactionDate) - new Date(b.transactionDate)
    );

    // Calculate opening balance and totals in one pass
    const balanceMap = new Map();
    let currentBalance = openingBalance;

    sortedTransactions.forEach((t) => {
      const tDate = new Date(t.transactionDate);

      if (tDate < startDate) {
        currentBalance = currentBalance + (t.credit ?? 0) - (t.debit ?? 0);
      }

      if (tDate >= startDate && tDate <= endDate) {
        const credit = t.credit ?? 0;
        const debit = t.debit ?? 0;

        totalCredit += credit;
        totalDebit += debit;
        currentBalance = currentBalance + credit - debit;
        balanceMap.set(t._id.toString(), currentBalance);
      }
    });

    const openingBalanceForPeriod = currentBalance;

    // Map transactions with running balance
    const transactionsWithBalance = transactions.map((t) => ({
      ...t,
      runningBalance: balanceMap.get(t._id.toString()) ?? currentBalance,
    }));

    return {
      openingBalance: openingBalanceForPeriod,
      closingBalance: currentBalance,
      totalCredit,
      totalDebit,
      transactionsWithBalance,
    };
  }, [
    state.filters.startDate,
    state.filters.endDate,
    transactions,
    memoizedAccount.initialBalance,
  ]);

  // Generate page numbers with ellipsis - memoized
  const pageNumbers = useMemo(() => {
    const currentPage = state.pagination.page;
    const totalPageCount = totalPages;
    const pages = [];

    if (totalPageCount <= 1) return [1];

    pages.push(1);

    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPageCount - 1, currentPage + 1);

    if (currentPage <= 3) {
      endPage = Math.min(5, totalPageCount - 1);
    }

    if (currentPage >= totalPageCount - 2) {
      startPage = Math.max(2, totalPageCount - 4);
    }

    if (startPage > 2) {
      pages.push("ellipsis-left");
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    if (endPage < totalPageCount - 1) {
      pages.push("ellipsis-right");
    }

    if (totalPageCount > 1) {
      pages.push(totalPageCount);
    }

    return pages;
  }, [state.pagination.page, totalPages]);

  // Stable event handlers wrapped in useCallback
  const handleDateChange = useCallback((field, value) => {
    setState((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        [field]: value,
      },
    }));
  }, []);

  const handleFilterSubmit = useCallback((e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setState((prev) => ({
      filters: {
        ...prev.filters,
        startDate: fd.get("startDate"),
        endDate: fd.get("endDate"),
        search: fd.get("search"),
      },
      pagination: {
        ...prev.pagination,
        page: 1,
      },
    }));
  }, []);

  const gotoPage = useCallback(
    (page) => {
      if (page >= 1 && page <= totalPages) {
        setState((prev) => ({
          ...prev,
          pagination: {
            ...prev.pagination,
            page,
          },
        }));
      }
    },
    [totalPages]
  );

  const handleLimitChange = useCallback((limit) => {
    setState((prev) => ({
      ...prev,
      pagination: {
        limit: parseInt(limit),
        page: 1,
      },
    }));
  }, []);

  // Memoized table body to prevent re-rendering all rows
  const tableBody = useMemo(() => {
    if (loading) {
      return (
        <tr>
          <td colSpan="5" className="py-12 text-center text-gray-400">
            Loading...
          </td>
        </tr>
      );
    }

    if (transactions.length === 0) {
      return (
        <tr>
          <td colSpan="5" className="py-12 text-center text-gray-400">
            No transactions found.
          </td>
        </tr>
      );
    }

    return stats.transactionsWithBalance.map((t, idx) => (
      <TransactionRow key={t._id} t={t} idx={idx} />
    ));
  }, [loading, transactions.length, stats.transactionsWithBalance]);

  // Memoized pagination controls
  const paginationControls = useMemo(
    () => (
      <div className="flex items-center gap-1">
        <PaginationButton
          onClick={() => gotoPage(1)}
          disabled={state.pagination.page === 1}
          className={`h-7 w-7 flex items-center justify-center rounded border ${
            state.pagination.page === 1
              ? "bg-gray-100 border-gray-200 text-gray-300 pointer-events-none"
              : "bg-white border-gray-300 hover:bg-gray-100 text-gray-600"
          }`}
          ariaLabel="First Page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </PaginationButton>

        <PaginationButton
          onClick={() => gotoPage(state.pagination.page - 1)}
          disabled={state.pagination.page === 1}
          className={`h-7 w-7 flex items-center justify-center rounded border ${
            state.pagination.page === 1
              ? "bg-gray-100 border-gray-200 text-gray-300 pointer-events-none"
              : "bg-white border-gray-300 hover:bg-gray-100 text-gray-600"
          }`}
          ariaLabel="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </PaginationButton>

        <div className="flex items-center gap-1 px-1">
          {pageNumbers.map((pageNum, index) => {
            if (pageNum === "ellipsis-left" || pageNum === "ellipsis-right") {
              return (
                <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
                  <MoreHorizontal className="w-4 h-4" />
                </span>
              );
            }

            return (
              <PaginationButton
                key={pageNum}
                onClick={() => gotoPage(pageNum)}
                className={`h-7 w-7 flex items-center justify-center rounded border text-xs ${
                  state.pagination.page === pageNum
                    ? "bg-blue-600 border-blue-600 text-white font-semibold"
                    : "bg-white border-gray-300 hover:bg-gray-100 text-gray-700"
                }`}
                ariaLabel={`Page ${pageNum}`}
              >
                {pageNum}
              </PaginationButton>
            );
          })}
        </div>

        <PaginationButton
          onClick={() => gotoPage(state.pagination.page + 1)}
          disabled={state.pagination.page >= totalPages}
          className={`h-7 w-7 flex items-center justify-center rounded border ${
            state.pagination.page >= totalPages
              ? "bg-gray-100 border-gray-200 text-gray-300 pointer-events-none"
              : "bg-white border-gray-300 hover:bg-gray-100 text-gray-600"
          }`}
          ariaLabel="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </PaginationButton>

        <PaginationButton
          onClick={() => gotoPage(totalPages)}
          disabled={state.pagination.page >= totalPages}
          className={`h-7 w-7 flex items-center justify-center rounded border ${
            state.pagination.page >= totalPages
              ? "bg-gray-100 border-gray-200 text-gray-300 pointer-events-none"
              : "bg-white border-gray-300 hover:bg-gray-100 text-gray-600"
          }`}
          ariaLabel="Last Page"
        >
          <ChevronsRight className="w-4 h-4" />
        </PaginationButton>
      </div>
    ),
    [state.pagination.page, totalPages, pageNumbers, gotoPage]
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 md:p-4 overflow-hidden">
      <div className="bg-white w-full max-w-7xl h-full md:h-[95vh] flex flex-col rounded-lg shadow-2xl overflow-hidden text-sm">
        {/* Header & Filters */}
        <div className="bg-white border-b border-gray-200 p-2 flex flex-col md:flex-row gap-2 justify-between items-center shrink-0">
          <div className="flex items-center gap-2 pl-2">
            <h1 className="font-bold text-gray-800 text-base">
              {memoizedAccount.title}
            </h1>
            <span className="text-gray-400">|</span>
            <span className="text-gray-500 text-xs font-mono">
              {memoizedAccount.slug}
            </span>
          </div>

          <form
            onSubmit={handleFilterSubmit}
            className="flex items-center gap-2 w-full md:w-auto"
          >
            <input type="hidden" name="showStatement" value="true" />
            <input type="hidden" name="accountId" value={memoizedAccount._id} />

            <div className="flex items-center border border-gray-300 rounded shadow-sm overflow-hidden h-8 bg-gray-50">
              <input
                type="date"
                name="startDate"
                value={state.filters.startDate}
                onChange={(e) => handleDateChange("startDate", e.target.value)}
                className="w-28 text-xs border-none bg-transparent focus:ring-0 px-2"
              />
              <span className="text-gray-400 text-[10px]">-</span>
              <input
                type="date"
                name="endDate"
                value={state.filters.endDate}
                onChange={(e) => handleDateChange("endDate", e.target.value)}
                className="w-28 text-xs border-none bg-transparent focus:ring-0 px-2"
              />
            </div>

            <div className="relative h-8">
              <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                name="search"
                defaultValue={state.filters.search}
                onChange={(e) => handleSearchChange(e.target.value)}
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

            <PrintButton filters={state.filters} account={memoizedAccount} />

            <button onClick={onClose}>
              <X className="w-5 h-5" />
            </button>
          </form>
        </div>

        {/* Stat Strip */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-around text-xs shrink-0">
          <div className="flex flex-col items-center">
            <span className="text-gray-500 uppercase tracking-wider text-[10px] font-semibold">
              Opening
            </span>
            <span className="font-mono font-medium text-gray-700">
              {memoizedAccount.currencySymbol}
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
              {memoizedAccount.currencySymbol}
              {money(stats.closingBalance)}
            </span>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto bg-white relative">
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
              {tableBody}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="border-t border-gray-200 bg-gray-50 p-2 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Show:</span>
              <select
                value={state.pagination.limit}
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

            <div className="text-xs text-gray-500">
              Showing{" "}
              <span className="font-medium">
                {(state.pagination.page - 1) * state.pagination.limit + 1}
              </span>
              -
              <span className="font-medium">
                {Math.min(
                  state.pagination.page * state.pagination.limit,
                  total
                )}
              </span>{" "}
              of <span className="font-medium">{total}</span> records
            </div>
          </div>

          {paginationControls}
        </div>
      </div>
    </div>
  );
}
