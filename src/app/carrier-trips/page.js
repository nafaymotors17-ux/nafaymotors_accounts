"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { getAllCarriers } from "@/app/lib/carriers-actions/carriers";
import { getAllCompanies } from "@/app/lib/carriers-actions/companies";
import { getAllUsersForSelection } from "@/app/lib/users-actions/users";
import { useUser } from "@/app/components/UserContext";
import SimpleCarriersTable from "./components/SimpleCarriersTable";
import CompactFilters from "./components/CompactFilters";

export default function CarriersPage() {
  // UI state for selected trips
  const [selectedTripIds, setSelectedTripIds] = useState([]);
  const searchParams = useSearchParams();
  const { user } = useUser();

  // Build query params from URL
  const queryParams = useMemo(() => {
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
  }, [searchParams]);

  // Server data with React Query
  const {
    data: carriersData,
    isLoading: carriersLoading,
  } = useQuery({
    queryKey: ["carriers", queryParams],
    queryFn: () => getAllCarriers(queryParams),
  });

  const {
    data: companiesData,
    isLoading: companiesLoading,
  } = useQuery({
    queryKey: ["companies"],
    queryFn: getAllCompanies,
  });

  const {
    data: usersData,
    isLoading: usersLoading,
  } = useQuery({
    queryKey: ["users"],
    queryFn: getAllUsersForSelection,
    enabled: user?.role === "super_admin",
  });

  // Derived values with useMemo
  const carriers = useMemo(
    () => carriersData?.carriers || [],
    [carriersData?.carriers]
  );

  const companies = useMemo(
    () => companiesData?.companies || [],
    [companiesData?.companies]
  );

  const users = useMemo(
    () => usersData?.users || [],
    [usersData?.users]
  );

  const pagination = useMemo(
    () => carriersData?.pagination,
    [carriersData?.pagination]
  );

  const isSuperAdmin = useMemo(
    () => user?.role === "super_admin",
    [user?.role]
  );

  // Get totals from API (calculated at database level with filters applied)
  const totals = useMemo(
    () => carriersData?.totals || {
      totalCars: 0,
      totalAmount: 0,
      totalExpenses: 0,
      totalProfit: 0,
      totalTrips: 0,
    },
    [carriersData?.totals]
  );

  const totalCars = totals.totalCars;
  const totalAmount = totals.totalAmount;
  const totalExpenses = totals.totalExpenses;
  const totalProfit = totals.totalProfit;
  const totalTrips = totals.totalTrips;

  // Check if company filter is selected
  const hasCompanyFilter = useMemo(
    () => !!queryParams.company,
    [queryParams.company]
  );

  const loading = carriersLoading || companiesLoading || usersLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Summary Cards - Top level stats shown first */}
        <div className={`grid grid-cols-1 gap-2 mb-3 ${hasCompanyFilter ? "md:grid-cols-3" : "md:grid-cols-5"}`}>
          <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
            <p className="text-[10px] text-gray-500 mb-0.5">Total Cars</p>
            <p className="text-lg font-bold text-gray-800">{totalCars}</p>
          </div>
          <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
            <p className="text-[10px] text-gray-500 mb-0.5">Total Amount</p>
            <p className="text-lg font-bold text-green-600">
              R{totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
          {!hasCompanyFilter && (
            <>
              <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
                <p className="text-[10px] text-gray-500 mb-0.5">Total Expenses</p>
                <p className="text-lg font-bold text-red-600">
                  R{totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
                <p className="text-[10px] text-gray-500 mb-0.5">Total Profit</p>
                <p className={`text-lg font-bold ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  R{totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </>
          )}
          <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
            <p className="text-[10px] text-gray-500 mb-0.5">Total Trips</p>
            <p className="text-lg font-bold text-blue-600">{totalTrips}</p>
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
          onSelectedTripsChange={setSelectedTripIds}
          currentUser={user}
        />
      </div>
    </div>
  );
}
