"use client";

import { useQuery } from "@tanstack/react-query";
import { getDieselExpensesByTrucks } from "@/app/lib/diesel-expenses-actions/diesel-expenses";
import { useUser } from "@/app/components/UserContext";
import { useState, useMemo, useEffect, useCallback } from "react";
import { RefreshCw, Fuel, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate } from "@/app/lib/utils/dateFormat";

const DIESEL_QUERY_KEY = ["diesel-expenses"];
const PER_PAGE = 25;

function getDefaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: now.toISOString().split("T")[0],
  };
}

export default function DieselExpensesPage() {
  const { user, loading: userLoading } = useUser();
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const [truckFilter, setTruckFilter] = useState([]);
  const [page, setPage] = useState(1);

  const userId = user?.userId ?? null;

  const queryKey = useMemo(
    () => [
      ...DIESEL_QUERY_KEY,
      userId,
      dateRange.startDate,
      dateRange.endDate,
      truckFilter.length ? truckFilter.sort().join(",") : "all",
    ],
    [userId, dateRange.startDate, dateRange.endDate, truckFilter]
  );

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      getDieselExpensesByTrucks(
        {
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
          truckIds: truckFilter.length > 0 ? truckFilter : undefined,
        },
        user
      ),
    enabled: !userLoading && !!userId,
  });

  const byTruck = useMemo(() => data?.byTruck ?? [], [data?.byTruck]);
  const overall = useMemo(
    () => data?.overall ?? { totalLiters: 0, totalAmount: 0, expenseCount: 0 },
    [data?.overall]
  );
  const trucks = useMemo(() => data?.trucks ?? [], [data?.trucks]);

  // Flatten to one list (date desc) and paginate
  const flatRows = useMemo(() => {
    const rows = [];
    for (const row of byTruck) {
      for (const exp of row.expenses) {
        rows.push({
          ...exp,
          truckName: row.truckName,
          truckNumber: row.truckNumber,
        });
      }
    }
    rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    return rows;
  }, [byTruck]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(flatRows.length / PER_PAGE)),
    [flatRows.length]
  );
  const paginatedRows = useMemo(
    () => flatRows.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [flatRows, page]
  );

  useEffect(() => setPage(1), [dateRange.startDate, dateRange.endDate, truckFilter.length]);

  const handleTruckSelect = useCallback((value) => {
    setTruckFilter(value === "all" ? [] : [value]);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pt-14 pb-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-3">
          <Fuel className="w-6 h-6 text-amber-600" />
          Diesel Expenses
        </h1>

        {/* Filters row */}
        <div className="bg-white rounded border border-gray-200 p-3 mb-3 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">From</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange((p) => ({ ...p, startDate: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">To</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange((p) => ({ ...p, endDate: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Truck</label>
            <select
              value={truckFilter.length === 0 ? "all" : truckFilter[0]}
              onChange={(e) => handleTruckSelect(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm min-w-[140px]"
            >
              <option value="all">All trucks</option>
              {trucks.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}{t.number ? ` (${t.number})` : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50 ml-auto"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {isLoading && (
          <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-3">
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            {/* Summary line */}
            <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 text-sm text-gray-700 flex flex-wrap gap-4">
              <span><strong>Liters:</strong> {overall.totalLiters.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span><strong>Total:</strong> R {(overall.totalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span><strong>Entries:</strong> {overall.expenseCount}</span>
            </div>

            {flatRows.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No diesel expenses in the selected range.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Truck</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Date</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600">Liters</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600">Price/L</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600">Amount</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map((row) => (
                        <tr key={row._id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-800">
                            {row.truckName}{row.truckNumber ? ` (${row.truckNumber})` : ""}
                          </td>
                          <td className="py-2 px-3 text-gray-800">{formatDate(row.date)}</td>
                          <td className="py-2 px-3 text-right text-gray-700">
                            {row.liters != null ? row.liters.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-700">
                            {row.pricePerLiter != null ? `R ${row.pricePerLiter.toFixed(2)}` : "—"}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-gray-800">
                            R {(row.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-gray-600 max-w-[180px] truncate" title={row.details}>
                            {row.details || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
                  <span>
                    Page {page} of {totalPages} ({flatRows.length} entries)
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
