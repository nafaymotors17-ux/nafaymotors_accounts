"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getAllCarriers } from "@/app/lib/carriers-actions/carriers";
import { getAllCompanies } from "@/app/lib/carriers-actions/companies";
import { getAllUsersForSelection } from "@/app/lib/users-actions/users";
import { useUser } from "@/app/components/UserContext";
import SimpleCarriersTable from "./components/SimpleCarriersTable";
import CompactFilters from "./components/CompactFilters";

const DEFAULT_TOTALS = {
  totalCars: 0,
  totalAmount: 0,
  totalExpenses: 0,
  totalProfit: 0,
  totalTrips: 0,
};

function buildParamsFromSearchParams(searchParams) {
  const params = {};
  const page = searchParams.get("page");
  const limit = searchParams.get("limit");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const company = searchParams.get("company");
  const carrierName = searchParams.get("carrierName");
  const isActive = searchParams.get("isActive");
  const userId = searchParams.get("userId");
  const globalSearch = searchParams.get("globalSearch");
  if (page) params.page = page;
  if (limit) params.limit = limit;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  if (company) params.company = company;
  if (carrierName) params.carrierName = carrierName;
  if (isActive) params.isActive = isActive;
  if (userId) params.userId = userId;
  if (globalSearch) params.globalSearch = globalSearch;
  return params;
}

export default function CarriersPage() {
  const [selectedTripIds, setSelectedTripIds] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const searchParams = useSearchParams();
  const { user } = useUser();

  const queryParams = useMemo(
    () => buildParamsFromSearchParams(searchParams),
    [searchParams],
  );

  // Trips list: React Query with staleTime 0 so we always get fresh data
  const {
    data: carriersData,
    isLoading: loading,
    error: carriersError,
    refetch: refetchCarriers,
  } = useQuery({
    queryKey: ["carriers", queryParams],
    queryFn: () => getAllCarriers(queryParams),
    staleTime: 0,
  });

  useEffect(() => {
    let cancelled = false;
    getAllCompanies().then(
      (res) => !cancelled && setCompanies(res?.companies || []),
    );
    if (user?.role === "super_admin") {
      getAllUsersForSelection().then(
        (res) => !cancelled && setUsers(res?.users || []),
      );
    }
    return () => {
      cancelled = true;
    };
  }, [user?.userId, user?.role]);

  // Stable derived data to avoid unnecessary child re-renders
  const carriers = useMemo(
    () => carriersData?.carriers ?? [],
    [carriersData?.carriers],
  );
  const pagination = useMemo(
    () => carriersData?.pagination ?? null,
    [carriersData?.pagination],
  );
  const totals = useMemo(
    () => carriersData?.totals ?? DEFAULT_TOTALS,
    [carriersData?.totals],
  );

  const totalCars = totals.totalCars;
  const totalAmount = totals.totalAmount;
  const totalExpenses = totals.totalExpenses;
  const totalProfit = totals.totalProfit;
  const totalTrips = totals.totalTrips;
  const hasCompanyFilter = !!queryParams.company;
  const isSuperAdmin = user?.role === "super_admin";
  const errorMessage = carriersError?.message ?? null;

  // Memoize stable callback so SimpleCarriersTable doesn't re-render unnecessarily
  const handleSelectedTripsChange = useCallback((ids) => {
    setSelectedTripIds(ids);
  }, []);

  // Memoize summary cards config to avoid recreating on every render
  const summaryGridClass = useMemo(
    () =>
      `grid grid-cols-1 gap-2 mb-3 ${hasCompanyFilter ? "md:grid-cols-3" : "md:grid-cols-5"}`,
    [hasCompanyFilter],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {errorMessage && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700">
            Error loading data: {errorMessage}
          </div>
        )}
        {/* Summary Cards - DB-level totals (all trips matching filters, not just current page) */}
        <div
          className={summaryGridClass}
          title="Totals are for all trips matching your filters, not just the current page"
        >
          <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
            <p className="text-[10px] text-gray-500 mb-0.5">Total Cars</p>
            <p className="text-lg font-bold text-gray-800">
              {loading ? "..." : totalCars}
            </p>
          </div>
          <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
            <p className="text-[10px] text-gray-500 mb-0.5">Total Amount</p>
            <p className="text-lg font-bold text-green-600">
              {loading
                ? "..."
                : `R${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            </p>
          </div>
          {!hasCompanyFilter && (
            <>
              <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
                <p className="text-[10px] text-gray-500 mb-0.5">
                  Total Expenses
                </p>
                <p className="text-lg font-bold text-red-600">
                  {loading
                    ? "..."
                    : `R${totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                </p>
              </div>
              <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
                <p className="text-[10px] text-gray-500 mb-0.5">Total Profit</p>
                <p
                  className={`text-lg font-bold ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {loading
                    ? "..."
                    : `R${totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                </p>
              </div>
            </>
          )}
          <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
            <p className="text-[10px] text-gray-500 mb-0.5">Total Trips</p>
            <p className="text-lg font-bold text-blue-600">
              {loading ? "..." : totalTrips}
            </p>
          </div>
        </div>

        {/* Compact Filters */}
        <CompactFilters
          companies={companies}
          carriers={carriers}
          isSuperAdmin={isSuperAdmin}
          users={users}
          selectedTripIds={selectedTripIds}
        />

        {/* Simple Carriers Table */}
        <SimpleCarriersTable
          carriers={carriers}
          companies={companies}
          users={users}
          pagination={pagination}
          isSuperAdmin={isSuperAdmin}
          loading={loading}
          onSelectedTripsChange={handleSelectedTripsChange}
          currentUser={user}
          onRefreshCarriers={refetchCarriers}
        />
      </div>
    </div>
  );
}
