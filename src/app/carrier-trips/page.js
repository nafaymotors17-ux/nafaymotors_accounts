"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { getAllCarriers } from "@/app/lib/carriers-actions/carriers";
import { getAllCompanies } from "@/app/lib/carriers-actions/companies";
import { getAllUsersForSelection } from "@/app/lib/users-actions/users";
import { useUser } from "@/app/components/UserContext";
import SimpleCarriersTable from "./components/SimpleCarriersTable";
import CompactFilters from "./components/CompactFilters";

export default function CarriersPage() {
  const [selectedTripIds, setSelectedTripIds] = useState([]);
  const [carriersData, setCarriersData] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const searchParams = useSearchParams();
  const { user } = useUser();

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

  const loadCarriers = useCallback(async () => {
    try {
      const res = await getAllCarriers(queryParams);
      setCarriersData(res);
    } catch (err) {
      setError(err?.message || "Failed to load carriers");
      setCarriersData({ carriers: [], pagination: null, totals: null });
    }
  }, [queryParams]);

  const loadCompanies = useCallback(async () => {
    try {
      const res = await getAllCompanies();
      setCompanies(res?.companies || []);
    } catch {
      setCompanies([]);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    if (user?.role !== "super_admin") return;
    try {
      const res = await getAllUsersForSelection();
      setUsers(res?.users || []);
    } catch {
      setUsers([]);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getAllCarriers(queryParams).then((res) => !cancelled && setCarriersData(res)),
      getAllCompanies().then((res) => !cancelled && setCompanies(res?.companies || [])),
      user?.role === "super_admin"
        ? getAllUsersForSelection().then((res) => !cancelled && setUsers(res?.users || []))
        : Promise.resolve(),
    ])
      .catch((err) => !cancelled && setError(err?.message || "Failed to load"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [queryParams, user?.userId, user?.role]);

  const carriers = carriersData?.carriers || [];
  const pagination = carriersData?.pagination;
  const totals = carriersData?.totals || {
    totalCars: 0,
    totalAmount: 0,
    totalExpenses: 0,
    totalProfit: 0,
    totalTrips: 0,
  };
  const totalCars = totals.totalCars;
  const totalAmount = totals.totalAmount;
  const totalExpenses = totals.totalExpenses;
  const totalProfit = totals.totalProfit;
  const totalTrips = totals.totalTrips;
  const hasCompanyFilter = !!queryParams.company;
  const isSuperAdmin = user?.role === "super_admin";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700">
            Error loading data: {error}
          </div>
        )}
        {/* Summary Cards - Top level stats shown first */}
        <div
          className={`grid grid-cols-1 gap-2 mb-3 ${hasCompanyFilter ? "md:grid-cols-3" : "md:grid-cols-5"}`}
        >
          <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
            <p className="text-[10px] text-gray-500 mb-0.5">Total Cars</p>
            <p className="text-lg font-bold text-gray-800">{totalCars}</p>
          </div>
          <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
            <p className="text-[10px] text-gray-500 mb-0.5">Total Amount</p>
            <p className="text-lg font-bold text-green-600">
              R
              {totalAmount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
          {!hasCompanyFilter && (
            <>
              <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
                <p className="text-[10px] text-gray-500 mb-0.5">
                  Total Expenses
                </p>
                <p className="text-lg font-bold text-red-600">
                  R
                  {totalExpenses.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
                <p className="text-[10px] text-gray-500 mb-0.5">Total Profit</p>
                <p
                  className={`text-lg font-bold ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  R
                  {totalProfit.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
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
          onRefreshCarriers={loadCarriers}
        />
      </div>
    </div>
  );
}
