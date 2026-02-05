"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Trash2, DollarSign, Wrench, AlertTriangle, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { formatDate } from "@/app/lib/utils/dateFormat";
import TruckExpenseForm from "../components/TruckExpenseForm";

const CATEGORY_LABELS = {
  fuel: "Fuel",
  maintenance: "Maintenance",
  tyre: "Tyre",
  others: "Others",
};

export default function TruckDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const truckId = params.truckId;

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maintenanceWarningDismissed, setMaintenanceWarningDismissed] = useState(false);

  // Fetch truck data
  const { data: truckData, isLoading: truckLoading, refetch: refetchTruck } = useQuery({
    queryKey: ["truck", truckId],
    queryFn: async () => {
      const response = await fetch(`/api/trucks/${truckId}`);
      if (!response.ok) throw new Error("Failed to fetch truck");
      return response.json();
    },
    enabled: !!truckId,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Build query params for expenses
  const expenseQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", limit.toString());
    if (categoryFilter) params.set("category", categoryFilter);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return params.toString();
  }, [page, limit, categoryFilter, startDate, endDate]);

  // Fetch truck expenses with filters and pagination
  const { data: expensesData, isLoading: expensesLoading, error: expensesError } = useQuery({
    queryKey: ["truck-expenses", truckId, expenseQueryParams],
    queryFn: async () => {
      const response = await fetch(`/api/trucks/${truckId}/expenses?${expenseQueryParams}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch expenses");
      }
      const data = await response.json();
      return data;
    },
    enabled: !!truckId,
    staleTime: 0,
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId) => {
      const response = await fetch(`/api/trucks/${truckId}/expenses/${expenseId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete expense");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["truck-expenses", truckId] });
      queryClient.invalidateQueries({ queryKey: ["truck", truckId] });
      queryClient.invalidateQueries({ queryKey: ["trucks"] });
    },
  });

  const handleDeleteExpense = (expenseId) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    deleteExpenseMutation.mutate(expenseId);
  };

  const handleCloseExpenseForm = async () => {
    setShowExpenseForm(false);
    // Invalidate and refetch to ensure fresh data
    queryClient.invalidateQueries({ queryKey: ["truck-expenses", truckId] });
    queryClient.invalidateQueries({ queryKey: ["truck", truckId] });
    queryClient.invalidateQueries({ queryKey: ["trucks"] });
    // Refetch truck data immediately to show updated maintenance info
    await queryClient.refetchQueries({ queryKey: ["truck", truckId] });
  };

  const handleFilterChange = () => {
    setPage(1); // Reset to first page when filters change
  };

  const handleLimitChange = (newLimit) => {
    setLimit(parseInt(newLimit));
    setPage(1); // Reset to first page when limit changes
  };

  const truck = truckData?.truck;
  const expenses = expensesData?.expenses || [];
  const pagination = expensesData?.pagination || { page: 1, totalPages: 1, total: 0 };
  const summaries = expensesData?.summaries || {
    totalExpense: 0,
    totalFuel: 0,
    totalFuelLiters: 0,
    totalMaintenance: 0,
    totalTyre: 0,
    totalOthers: 0,
    byCategory: { maintenance: 0, fuel: 0, tyre: 0, others: 0 }
  };
  
  // Calculate maintenance info - show negative when exceeded
  const nextMaintenanceKm = (truck?.lastMaintenanceKm || 0) + (truck?.maintenanceInterval || 1000);
  const kmsRemaining = nextMaintenanceKm - (truck?.currentMeterReading || 0);
  const maintenanceStatus = kmsRemaining <= 0 ? "overdue" : kmsRemaining <= 500 ? "due_soon" : "ok";
  const maintenanceDisplay = kmsRemaining <= 0 
    ? `-${Math.abs(kmsRemaining).toLocaleString("en-US")} km exceeded`
    : `${kmsRemaining.toLocaleString("en-US")} km remaining`;
  
  const loading = truckLoading || expensesLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-4">
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-3"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!truck) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Truck not found</p>
          <button
            onClick={() => router.push("/carriers")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Trucks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-4">
        {/* Compact Header */}
        <div className="bg-white rounded-lg shadow-sm p-3 mb-4">
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-800">
                {truck.name}
                {truck.number && <span className="text-sm font-normal text-gray-600 ml-2">#{truck.number}</span>}
              </h1>
              {truck.drivers && truck.drivers.length > 0 && (
                <p className="text-xs text-gray-600 mt-0.5">
                  Drivers: {truck.drivers.map(d => d.name).join(", ")}
                </p>
              )}
            </div>
            <button
              onClick={() => router.push("/carriers")}
              className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1 text-sm"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          </div>
        </div>

        {/* Maintenance Alert - Top Priority */}
        {maintenanceStatus !== "ok" && !maintenanceWarningDismissed && (
          <div className={`mb-4 p-3 rounded-lg border-2 relative ${
            maintenanceStatus === "overdue" ? "bg-red-100 border-red-400" : "bg-yellow-100 border-yellow-400"
          }`}>
            <button
              onClick={() => setMaintenanceWarningDismissed(true)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              title="Dismiss warning"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3 pr-6">
              <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                maintenanceStatus === "overdue" ? "text-red-600" : "text-yellow-600"
              }`} />
              <div className="flex-1">
                <p className={`text-sm font-bold mb-1 ${
                  maintenanceStatus === "overdue" ? "text-red-800" : "text-yellow-800"
                }`}>
                  {maintenanceStatus === "overdue" ? "⚠️ Maintenance Overdue!" : "⚠️ Maintenance Due Soon"}
                </p>
                <p className={`text-xs ${
                  maintenanceStatus === "overdue" ? "text-red-700" : "text-yellow-700"
                }`}>
                  {maintenanceStatus === "overdue" 
                    ? `Last maintenance was at ${truck.lastMaintenanceKm?.toLocaleString("en-US") || "0"} km${truck.lastMaintenanceDate ? ` on ${formatDate(truck.lastMaintenanceDate)}` : ""}. Current reading: ${truck.currentMeterReading?.toLocaleString("en-US") || "0"} km. Maintenance is ${Math.abs(kmsRemaining).toLocaleString("en-US")} km overdue!`
                    : `Next maintenance due at ${nextMaintenanceKm.toLocaleString("en-US")} km. Only ${kmsRemaining.toLocaleString("en-US")} km remaining.`
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Side by Side Layout: Table Left, Cards Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Side: Expenses Table */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-semibold text-gray-800">Expenses</h2>
              <button
                onClick={() => setShowExpenseForm(true)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1.5 text-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Expense
              </button>
            </div>

            {/* Filters */}
            <div className="mb-4 p-2 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-[10px] font-medium text-gray-700">Filters</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                  Expense Type
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    handleFilterChange();
                  }}
                  className="w-full px-2 py-1 text-[10px] border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="fuel">Fuel</option>
                  <option value="tyre">Tyre</option>
                  <option value="others">Others</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    handleFilterChange();
                  }}
                  className="w-full px-2 py-1 text-[10px] border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    handleFilterChange();
                  }}
                  className="w-full px-2 py-1 text-[10px] border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setCategoryFilter("");
                    setStartDate("");
                    setEndDate("");
                    handleFilterChange();
                  }}
                  className="w-full px-2 py-1 text-[10px] border border-gray-300 rounded-md hover:bg-gray-100 text-gray-700"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

            {expensesError && (
              <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                <p className="font-semibold">Error loading expenses:</p>
                <p>{expensesError.message || "Unknown error"}</p>
              </div>
            )}

            {expensesLoading ? (
              <div className="text-center py-6 text-gray-500">
                <p className="text-xs">Loading expenses...</p>
              </div>
            ) : expensesError ? (
              <div className="text-center py-6 text-red-500">
                <p className="text-xs">Error loading expenses. Please try again.</p>
              </div>
            ) : expenses && expenses.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <DollarSign className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                <p className="text-xs">No expenses found. Click "Add Expense" to add expenses.</p>
              </div>
            ) : expenses && expenses.length > 0 ? (
              <>
                <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">#</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Date</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Category</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Details</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Liters</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Price/L</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Meter (km)</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Tyre Number</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Tyre Info</th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-600">Amount</th>
                      <th className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {expenses.map((expense, index) => (
                      <tr key={expense._id} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 text-gray-600">
                          {(pagination.page - 1) * limit + index + 1}
                        </td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap text-[10px]">
                          {formatDate(expense.date)}
                        </td>
                        <td className="px-2 py-1.5 text-[10px]">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
                            expense.category === "fuel" ? "bg-blue-100 text-blue-800" :
                            expense.category === "maintenance" ? "bg-green-100 text-green-800" :
                            expense.category === "tyre" ? "bg-orange-100 text-orange-800" :
                            expense.category === "others" ? "bg-purple-100 text-purple-800" :
                            "bg-gray-100 text-gray-800"
                          }`}>
                            {expense.category === "maintenance" && <Wrench className="w-3 h-3" />}
                            {CATEGORY_LABELS[expense.category] || expense.category}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-[10px] max-w-[150px] truncate" title={expense.details || ""}>
                          {expense.details || "-"}
                        </td>
                        <td className="px-2 py-1.5 text-[10px]">
                          {expense.category === "fuel" && expense.liters ? expense.liters.toFixed(2) : "-"}
                        </td>
                        <td className="px-2 py-1.5 text-[10px]">
                          {expense.category === "fuel" && expense.pricePerLiter ? `R${expense.pricePerLiter.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-2 py-1.5 text-[10px]">
                          {(expense.category === "maintenance" || expense.category === "tyre") && expense.meterReading 
                            ? expense.meterReading.toLocaleString("en-US") 
                            : "-"}
                        </td>
                        <td className="px-2 py-1.5 text-[10px]">
                          {expense.category === "tyre" && expense.tyreNumber ? expense.tyreNumber : "-"}
                        </td>
                        <td className="px-2 py-1.5 text-[10px] max-w-[150px] truncate" title={expense.tyreInfo || ""}>
                          {expense.category === "tyre" && expense.tyreInfo ? expense.tyreInfo : "-"}
                        </td>
                        <td className="px-2 py-1.5 text-right text-red-600 font-semibold text-[10px]">
                          R{expense.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleDeleteExpense(expense._id)}
                              className="text-red-600 hover:text-red-800"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

                {/* Pagination */}
                {(pagination.totalPages > 1 || pagination.total > 0) && (
                  <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-gray-200 pt-2">
                    <div className="flex items-center gap-2">
                      <div className="text-[10px] text-gray-600">
                        Showing {(pagination.page - 1) * limit + 1} to {Math.min(pagination.page * limit, pagination.total)} of {pagination.total}
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-gray-600">Show:</label>
                        <select
                          value={limit}
                          onChange={(e) => handleLimitChange(e.target.value)}
                          className="px-1.5 py-0.5 text-[10px] border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                    </div>
                    {pagination.totalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={!pagination.hasPrevPage}
                          className="px-2 py-1 text-[10px] border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-0.5"
                        >
                          <ChevronLeft className="w-3 h-3" />
                          Prev
                        </button>
                        <span className="text-[10px] text-gray-600 px-1">
                          {pagination.page}/{pagination.totalPages}
                        </span>
                        <button
                          onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                          disabled={!pagination.hasNextPage}
                          className="px-2 py-1 text-[10px] border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-0.5"
                        >
                          Next
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Right Side: Compact Summary Cards */}
          <div className="lg:col-span-1 space-y-3">
            {/* Main Summary Cards */}
            <div className="bg-white rounded-lg shadow-sm p-3">
              <h3 className="text-xs font-semibold text-gray-700 mb-2">Overview</h3>
              <div className="space-y-2">
                {/* Next Maintenance - Highlighted at Top */}
                <div className={`p-3 rounded-lg border-2 ${
                  maintenanceStatus === "overdue" ? "bg-red-100 border-red-400" : 
                  maintenanceStatus === "due_soon" ? "bg-yellow-100 border-yellow-400" : 
                  "bg-green-100 border-green-400"
                }`}>
                  <p className="text-[9px] font-semibold text-gray-700 mb-1 uppercase tracking-wide">Next Maintenance At</p>
                  <p className={`text-lg font-bold ${
                    maintenanceStatus === "overdue" ? "text-red-700" : 
                    maintenanceStatus === "due_soon" ? "text-yellow-700" : 
                    "text-green-700"
                  }`}>
                    {nextMaintenanceKm.toLocaleString("en-US")} km
                  </p>
                  <p className={`text-[9px] mt-1 ${
                    maintenanceStatus === "overdue" ? "text-red-600" : 
                    maintenanceStatus === "due_soon" ? "text-yellow-600" : 
                    "text-green-600"
                  }`}>
                    {maintenanceDisplay}
                  </p>
                </div>
                <div className="bg-blue-50 p-2 rounded">
                  <p className="text-[9px] text-gray-600 mb-0.5">Current KM</p>
                  <p className="text-sm font-bold text-blue-600">
                    {truck.currentMeterReading?.toLocaleString("en-US") || "0"}
                  </p>
                </div>
                <div className="bg-red-50 p-2 rounded">
                  <p className="text-[9px] text-gray-600 mb-0.5">Total Expenses</p>
                  <p className="text-sm font-bold text-red-600">
                    R{summaries.totalExpense.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`p-2 rounded ${
                  maintenanceStatus === "overdue" ? "bg-red-50" : 
                  maintenanceStatus === "due_soon" ? "bg-yellow-50" : 
                  "bg-green-50"
                }`}>
                  <p className="text-[9px] text-gray-600 mb-0.5">Maintenance</p>
                  <p className={`text-xs font-bold ${
                    maintenanceStatus === "overdue" ? "text-red-600" : 
                    maintenanceStatus === "due_soon" ? "text-yellow-600" : 
                    "text-green-600"
                  }`}>
                    {maintenanceDisplay}
                  </p>
                </div>
              </div>
            </div>

            {/* Expense Breakdown */}
            <div className="bg-white rounded-lg shadow-sm p-3">
              <h3 className="text-xs font-semibold text-gray-700 mb-2">Expense Breakdown</h3>
              <div className="space-y-1.5">
                <div className="bg-blue-50 p-1.5 rounded">
                  <p className="text-[9px] text-gray-600 mb-0.5">Fuel</p>
                  <p className="text-xs font-semibold text-blue-600">
                    R{summaries.totalFuel.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  {summaries.totalFuelLiters > 0 && (
                    <p className="text-[9px] text-gray-500 mt-0.5">
                      {summaries.totalFuelLiters.toFixed(2)} L
                    </p>
                  )}
                </div>
                <div className="bg-green-50 p-1.5 rounded">
                  <p className="text-[9px] text-gray-600 mb-0.5">Maintenance</p>
                  <p className="text-xs font-semibold text-green-600">
                    R{summaries.totalMaintenance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-orange-50 p-1.5 rounded">
                  <p className="text-[9px] text-gray-600 mb-0.5">Tyre</p>
                  <p className="text-xs font-semibold text-orange-600">
                    R{summaries.totalTyre.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {summaries.totalOthers > 0 && (
                  <div className="bg-purple-50 p-1.5 rounded">
                    <p className="text-[9px] text-gray-600 mb-0.5">Others</p>
                    <p className="text-xs font-semibold text-purple-600">
                      R{summaries.totalOthers.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Maintenance Info */}
            <div className="bg-white rounded-lg shadow-sm p-3">
              <h3 className="text-xs font-semibold text-gray-700 mb-2">Maintenance Info</h3>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-600">Interval:</span>
                  <span className="font-medium">{truck.maintenanceInterval?.toLocaleString("en-US") || "0"} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last KM:</span>
                  <span className="font-medium">{truck.lastMaintenanceKm?.toLocaleString("en-US") || "0"} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Date:</span>
                  <span className="font-medium">
                    {truck.lastMaintenanceDate ? formatDate(truck.lastMaintenanceDate) : "Never"}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-200">
                  <span className="text-gray-600">Next At:</span>
                  <span className={`font-medium ${
                    maintenanceStatus === "overdue" ? "text-red-600" : 
                    maintenanceStatus === "due_soon" ? "text-yellow-600" : 
                    "text-green-600"
                  }`}>
                    {nextMaintenanceKm.toLocaleString("en-US")} km
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Expense Form Modal */}
      {showExpenseForm && truck && (
        <TruckExpenseForm
          truckId={truckId}
          truck={truck}
          expense={null}
          onClose={handleCloseExpenseForm}
        />
      )}
    </div>
  );
}
