"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, ChevronDown, ChevronRight, Edit, Trash2, FileSpreadsheet } from "lucide-react";
import CarrierTripForm from "./CarrierTripForm";
import CarForm from "./CarForm";
import { deleteCar } from "@/app/lib/carriers-actions/cars";
import { formatDate } from "@/app/lib/utils/dateFormat";
import { getAllCarriers, deleteCarrier } from "@/app/lib/carriers-actions/carriers";
import { exportCarriersAndCars } from "@/app/lib/utils/exportCarriers";

// Component to show truncated text with ellipsis indicator
function TruncatedText({ text, maxLines = 2, className = "" }) {
  if (!text) {
    return <span className="text-gray-400">-</span>;
  }

  return (
    <div
      className={`whitespace-normal ${className}`}
      title={text}
      style={{
        display: '-webkit-box',
        WebkitLineClamp: maxLines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        wordBreak: 'break-word',
        lineHeight: '1.2em',
        textOverflow: 'ellipsis'
      }}
    >
      {text}
    </div>
  );
}

// Hook for fetching cars for a carrier
function useCarrierCars(carrierId, filters, enabled) {
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.company) params.set("company", filters.company);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    return params.toString();
  }, [filters]);

  return useQuery({
    queryKey: ["carrierCars", carrierId, queryParams],
    queryFn: async () => {
      const url = `/api/carriers/${carrierId}/cars${queryParams ? `?${queryParams}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch cars");
      return response.json();
    },
    enabled: enabled && !!carrierId,
  });
}

export default function SimpleCarriersTable({
  carriers,
  companies,
  users = [],
  pagination,
  isSuperAdmin = false,
  loading = false,
  onSelectedTripsChange,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // UI state only
  const [expandedTrips, setExpandedTrips] = useState(new Set());
  const [showTripForm, setShowTripForm] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState(null);
  const [showCarForm, setShowCarForm] = useState({});
  const [carFormCarrier, setCarFormCarrier] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedTripIds, setSelectedTripIds] = useState(new Set());

  // Notify parent when selected trips change
  const handleSelectedTripsChange = useCallback((newSelectedTrips) => {
    setSelectedTripIds(newSelectedTrips);
    if (onSelectedTripsChange) {
      onSelectedTripsChange(Array.from(newSelectedTrips));
    }
  }, [onSelectedTripsChange]);

  // Derived values with useMemo
  const currentFilters = useMemo(() => ({
    company: searchParams.get("company") || "",
    startDate: searchParams.get("startDate") || "",
    endDate: searchParams.get("endDate") || "",
  }), [searchParams]);

  // Mutations
  const deleteCarMutation = useMutation({
    mutationFn: deleteCar,
    onSuccess: (_, carId) => {
      // Invalidate carrier cars queries
      queryClient.invalidateQueries({ queryKey: ["carrierCars"] });
      // Invalidate carriers to update counts
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
    },
  });

  const deleteCarrierMutation = useMutation({
    mutationFn: deleteCarrier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (carrierId) => {
      const response = await fetch(`/api/carriers/${carrierId}/toggle-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
    },
  });

  const toggleTrip = useCallback((carrierId) => {
    const carrierIdStr = carrierId.toString();
    setExpandedTrips((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(carrierIdStr)) {
        newExpanded.delete(carrierIdStr);
      } else {
        newExpanded.add(carrierIdStr);
      }
      return newExpanded;
    });
  }, []);

  const handleDeleteCar = useCallback(
    async (carId, carrierId) => {
      if (!confirm("Are you sure you want to delete this car?")) return;
      deleteCarMutation.mutate(carId);
    },
    [deleteCarMutation]
  );

  const handleDeleteCarrier = useCallback(
    async (carrierId, tripNumber) => {
      const carrierIdStr = carrierId.toString();
      const tripDisplay = tripNumber || carrierIdStr;

      const confirmed = window.confirm(
        `Are you sure you want to delete trip "${tripDisplay}"?\n\nThis will permanently delete:\n- The trip/carrier\n- All cars associated with this trip\n\nThis action cannot be undone!`
      );

      if (!confirmed) return;
      deleteCarrierMutation.mutate(carrierIdStr, {
        onSuccess: (result) => {
          alert(`Trip deleted successfully. ${result.deletedCarsCount} car(s) were also deleted.`);
        },
        onError: (error) => {
          alert(error.message || "Failed to delete trip");
        },
      });
    },
    [deleteCarrierMutation]
  );

  const handleToggleActive = useCallback(
    (e, carrierId, currentStatus) => {
      e.preventDefault();
      e.stopPropagation();

      const carrierIdStr = carrierId?.toString ? carrierId.toString() : String(carrierId);
      const newStatus = currentStatus === false ? true : false;

      // Optimistic update
      queryClient.setQueryData(["carriers"], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          carriers: oldData.carriers.map((carrier) =>
            carrier._id.toString() === carrierIdStr
              ? { ...carrier, isActive: newStatus }
              : carrier
          ),
        };
      });

      toggleActiveMutation.mutate(carrierIdStr, {
        onError: () => {
          // Revert on error
          queryClient.invalidateQueries({ queryKey: ["carriers"] });
        },
      });
    },
    [toggleActiveMutation, queryClient]
  );

  const handleExportToExcel = useCallback(async () => {
    setIsExporting(true);
    try {
      const currentParams = {
        company: searchParams.get("company") || "",
        startDate: searchParams.get("startDate") || "",
        endDate: searchParams.get("endDate") || "",
        isActive: searchParams.get("isActive") || "",
        limit: 10000,
        page: 1,
      };

      const result = await getAllCarriers(currentParams);
      const allCarriers = result?.carriers || result?.carriers || [];

      if (allCarriers.length === 0) {
        alert("No trips found to export");
        return;
      }

      exportCarriersAndCars(allCarriers, currentParams, isSuperAdmin);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert(error.message || "Failed to export to Excel. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [searchParams, isSuperAdmin]);


  const handleCarFormClose = useCallback(
    (carrierIdStr) => {
      setShowCarForm((prev) => ({ ...prev, [carrierIdStr]: false }));
      setCarFormCarrier(null);
      // Invalidate cars query for this carrier
      queryClient.invalidateQueries({ queryKey: ["carrierCars", carrierIdStr] });
      // Invalidate carriers to update counts
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
    },
    [queryClient]
  );

  // Derived pagination info
  const paginationInfo = useMemo(() => {
    if (!pagination) return null;
    return {
      start: (pagination.page - 1) * pagination.limit + 1,
      end: Math.min(pagination.page * pagination.limit, pagination.total),
      total: pagination.total,
    };
  }, [pagination]);

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-2 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-800">Carrier Trips</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportToExcel}
              disabled={isExporting || carriers.length === 0}
              className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1 text-xs"
              title="Export filtered trips to Excel"
            >
              <FileSpreadsheet className="w-3 h-3" />
              {isExporting ? "Exporting..." : "Export Excel"}
            </button>
            <button
              onClick={() => {
                setShowTripForm(true);
                setEditingCarrier(null);
              }}
              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1 text-xs"
            >
              <Plus className="w-3 h-3" />
              New Trip
            </button>
          </div>
        </div>

        {/* Pagination - Moved to top */}
        {pagination && pagination.total > 0 && paginationInfo && (
          <div className="p-3 border-b bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-xs text-gray-600">
              Showing {paginationInfo.start} to {paginationInfo.end} of{" "}
              {paginationInfo.total} trips
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Page size:</label>
              <select
                value={pagination.limit}
                onChange={(e) => {
                  const params = new URLSearchParams(window.location.search);
                  params.set("limit", e.target.value);
                  params.set("page", "1");
                  router.push(`/carrier-trips?${params.toString()}`);
                }}
                className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set("page", (pagination.page - 1).toString());
                    router.push(`/carrier-trips?${params.toString()}`);
                  }}
                  disabled={!pagination.hasPrevPage}
                  className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Prev
                </button>
                <span className="px-2 py-1 text-xs text-gray-700">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set("page", (pagination.page + 1).toString());
                    router.push(`/carrier-trips?${params.toString()}`);
                  }}
                  disabled={!pagination.hasNextPage}
                  className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            <p>Loading trips...</p>
          </div>
        ) : carriers.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            <p>No trips found. Create your first trip to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 py-1.5 text-center font-medium text-gray-600 text-[10px] w-8">
                    <input
                      type="checkbox"
                      checked={carriers.filter(c => (c.type === "trip" || (!c.type && c.tripNumber))).length > 0 && 
                               carriers.filter(c => (c.type === "trip" || (!c.type && c.tripNumber)))
                                 .every(c => selectedTripIds.has(c._id.toString()))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const tripIds = carriers
                            .filter(c => (c.type === "trip" || (!c.type && c.tripNumber)))
                            .map(c => c._id.toString());
                          handleSelectedTripsChange(new Set(tripIds));
                        } else {
                          handleSelectedTripsChange(new Set());
                        }
                      }}
                      className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      title="Select all trips"
                    />
                  </th>
                  <th className="px-2 py-1.5 text-left font-medium text-gray-600 text-[10px] w-6"></th>
                  <th className="px-2 py-1.5 text-center font-medium text-gray-600 text-[10px] w-8">#</th>
                  <th className="px-2 py-1.5 text-left font-medium text-gray-600 text-[10px]">TRIPS</th>
                  {isSuperAdmin && (
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600 text-[10px]">USER</th>
                  )}
                  <th className="px-2 py-1.5 text-left font-medium text-gray-600 text-[10px]">DATE</th>
                  <th className="px-2 py-1.5 text-left font-medium text-gray-600 text-[10px]">TRUCK/DRIVER</th>
                  <th className="px-2 py-1.5 text-left font-medium text-gray-600 text-[10px]">DISTANCE (km)</th>
                  <th className="px-2 py-1.5 text-left font-medium text-gray-600 text-[10px] min-w-[200px]">NOTES</th>
                  <th className="px-2 py-1.5 text-right font-medium text-gray-600 text-[10px]">CARS</th>
                  <th className="px-2 py-1.5 text-right font-medium text-gray-600 text-[10px]">TOTAL</th>
                  <th className="px-2 py-1.5 text-right font-medium text-gray-600 text-[10px]">EXPENSE</th>
                  <th className="px-2 py-1.5 text-right font-medium text-gray-600 text-[10px]">PROFIT</th>
                  <th className="px-2 py-1.5 text-center font-medium text-gray-600 text-[10px]">ACT</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {carriers.map((carrier, index) => {
                  const carrierIdStr = carrier._id.toString();
                  const isExpanded = expandedTrips.has(carrierIdStr);

                  return (
                    <CarrierCarsRow
                      key={carrier._id}
                      carrier={carrier}
                      index={index}
                      pagination={pagination}
                      isSuperAdmin={isSuperAdmin}
                      isExpanded={isExpanded}
                      filters={currentFilters}
                      selectedTripIds={selectedTripIds}
                      onToggleTripSelection={(tripId, checked) => {
                        const newSet = new Set(selectedTripIds);
                        if (checked) {
                          newSet.add(tripId);
                        } else {
                          newSet.delete(tripId);
                        }
                        handleSelectedTripsChange(newSet);
                      }}
                      onToggle={toggleTrip}
                      onEdit={() => {
                        setEditingCarrier(carrier);
                        setShowTripForm(true);
                      }}
                      onDelete={handleDeleteCarrier}
                      onToggleActive={handleToggleActive}
                      onDeleteCar={handleDeleteCar}
                      onAddCar={() => {
                        setCarFormCarrier(carrier);
                        setShowCarForm((prev) => ({ ...prev, [carrierIdStr]: true }));
                      }}
                      companies={companies}
                      users={users}
                      toggleActiveMutation={toggleActiveMutation}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showTripForm && (
        <CarrierTripForm
          carrier={editingCarrier}
          users={users}
          onClose={() => {
            setShowTripForm(false);
            setEditingCarrier(null);
            queryClient.invalidateQueries({ queryKey: ["carriers"] });
          }}
        />
      )}

      {carFormCarrier && showCarForm[carFormCarrier._id.toString()] && (
        <CarForm
          carrier={carFormCarrier}
          companies={companies}
          users={users}
          onClose={() => handleCarFormClose(carFormCarrier._id.toString())}
        />
      )}
    </>
  );
}

// Extracted row component for better organization
function CarrierCarsRow({
  carrier,
  index,
  pagination,
  isSuperAdmin,
  isExpanded,
  filters,
  selectedTripIds,
  onToggleTripSelection,
  onToggle,
  onEdit,
  onDelete,
  onToggleActive,
  onDeleteCar,
  onAddCar,
  companies,
  users,
  toggleActiveMutation,
}) {
  const carrierIdStr = carrier._id.toString();
  const isToggling = toggleActiveMutation.isPending;

  // Fetch cars when expanded using React Query
  const { data: carsData } = useCarrierCars(carrierIdStr, filters, isExpanded);
  const cars = carsData?.cars || carrier.cars || [];

  // Derived values with useMemo
  const carsTotal = useMemo(
    () => cars.reduce((sum, car) => sum + (car.amount || 0), 0),
    [cars]
  );

  const totalAmount = carrier.totalAmount || carsTotal;
  const totalExpense = carrier.totalExpense || 0;
  const profit = totalAmount - totalExpense;
  const rowNumber = pagination
    ? (pagination.page - 1) * pagination.limit + index + 1
    : index + 1;

  const isTrip = carrier.type === "trip" || (!carrier.type && carrier.tripNumber);
  const isSelected = selectedTripIds.has(carrierIdStr);

  return (
    <>
      <tr
        className={`hover:bg-gray-50 ${
          carrier.isActive === false ? "opacity-60 bg-gray-100" : ""
        } ${isSelected ? "bg-blue-50" : ""}`}
      >
        <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
          {isTrip && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleTripSelection(carrierIdStr, e.target.checked);
              }}
              className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </td>
        <td className="px-2 py-1.5 text-gray-400 cursor-pointer" onClick={() => onToggle(carrierIdStr)}>
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </td>
        <td className="px-2 py-1.5 text-center text-gray-600 font-medium">
          {rowNumber}
        </td>
        <td className="px-1.5 py-1.5 font-semibold text-gray-900">
          <div className="flex items-center gap-1">
            {isTrip ? (
              <a
                href={`/carrier-trips/${carrierIdStr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                {carrier.tripNumber || carrier.name || "N/A"}
              </a>
            ) : (
              <span className="cursor-pointer" onClick={() => onToggle(carrierIdStr)}>
                {carrier.tripNumber || carrier.name || "N/A"}
              </span>
            )}
            {carrier.type === "company" && (
              <span className="text-[8px] text-gray-500 bg-gray-100 px-1 py-0.5 rounded">
                CO
              </span>
            )}
          </div>
        </td>
        {isSuperAdmin && (
          <td className="px-2 py-1.5 text-gray-600 text-[10px]">
            {carrier.user?.username ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800">
                {carrier.user.username}
              </span>
            ) : (
              <span className="text-gray-400">N/A</span>
            )}
          </td>
        )}
        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">
          {formatDate(carrier.date)}
        </td>
        <td
          className="px-2 py-1.5 text-gray-600 text-[10px] max-w-[150px]"
          title={
            `${carrier.truckData?.name || carrier.carrierName || ""} ${
              carrier.truckData?.drivers && carrier.truckData.drivers.length > 0
                ? `- ${carrier.truckData.drivers.map(d => d.name).join(", ")}`
                : carrier.driverName ? `- ${carrier.driverName}` : ""
            }`
          }
        >
          <div className="truncate">
            <div className="font-medium">
              {carrier.truckData?.name || carrier.carrierName || "-"}
            </div>
            {carrier.truckData?.drivers && carrier.truckData.drivers.length > 0 ? (
              <div className="text-[9px] text-gray-500 truncate">
                {carrier.truckData.drivers.map(d => d.name).join(", ")}
              </div>
            ) : carrier.driverName ? (
              <div className="text-[9px] text-gray-500 truncate">
                {carrier.driverName}
              </div>
            ) : null}
          </div>
        </td>
        <td className="px-2 py-1.5 text-gray-600 text-[10px] text-right">
          {carrier.distance ? carrier.distance.toLocaleString("en-US") : "-"}
        </td>
        <td className="px-2 py-2 text-gray-700 text-[10px] min-w-[200px] max-w-[250px]">
          <TruncatedText text={carrier.notes} maxLines={2} />
        </td>
        <td className="px-2 py-1.5 text-right text-gray-700">
          {carrier.carCount || 0}
        </td>
        <td className="px-2 py-1.5 text-right text-green-600 font-semibold whitespace-nowrap">
          R{(carrier.totalAmount || 0).toLocaleString("en-US", {
            minimumFractionDigits: 2,
          })}
        </td>
        <td className="px-2 py-1.5 text-right text-red-600 whitespace-nowrap">
          R{(carrier.totalExpense || 0).toLocaleString("en-US", {
            minimumFractionDigits: 2,
          })}
        </td>
        <td
          className={`px-2 py-1.5 text-right font-semibold whitespace-nowrap ${
            profit >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          R{profit.toLocaleString("en-US", {
            minimumFractionDigits: 2,
          })}
        </td>
        <td
          className="px-2 py-1.5 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={onEdit}
              className="text-gray-600 hover:text-gray-800"
              title="Edit Trip"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            {isSuperAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(carrier._id, carrier.tripNumber || carrier.name);
                }}
                className="text-red-600 hover:text-red-800"
                title="Delete Trip (Super Admin Only)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            {(carrier.type === "trip" ||
              (!carrier.type && carrier.tripNumber)) && (
              <button
                type="button"
                onClick={(e) => {
                  onToggleActive(e, carrier._id, carrier.isActive);
                }}
                disabled={isToggling}
                className={`px-1.5 py-0.5 text-[9px] font-medium rounded border transition-colors ${
                  carrier.isActive === false
                    ? "bg-red-100 text-red-700 border-red-300 hover:bg-red-200"
                    : "bg-green-100 text-green-700 border-green-300 hover:bg-green-200"
                } ${isToggling ? "opacity-50 cursor-not-allowed" : ""}`}
                title={`Click to mark as ${
                  carrier.isActive === false ? "Active" : "Inactive"
                }`}
              >
                {isToggling
                  ? "..."
                  : carrier.isActive === false
                  ? "Inactive"
                  : "Active"}
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded Cars Table */}
      {isExpanded && (
        <tr>
          <td
            colSpan={isSuperAdmin ? 14 : 13}
            className="px-0 py-0 bg-gray-50"
          >
            <div className="px-2 py-2">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-semibold text-gray-700">
                  Cars ({cars.length})
                </h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddCar();
                  }}
                  className="px-2 py-0.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>

              {cars.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-3">
                  No cars in this trip. Click "Add" to get started.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-1.5 py-1 text-left font-medium text-gray-600 text-[10px]">
                          #
                        </th>
                        <th className="px-1.5 py-1 text-left font-medium text-gray-600 text-[10px]">
                          DATE
                        </th>
                        <th className="px-1.5 py-1 text-left font-medium text-gray-600 text-[10px]">
                          STOCK
                        </th>
                        <th className="px-1.5 py-1 text-left font-medium text-gray-600 text-[10px]">
                          COMPANY
                        </th>
                        <th className="px-1.5 py-1 text-left font-medium text-gray-600 text-[10px]">
                          NAME
                        </th>
                        <th className="px-1.5 py-1 text-left font-medium text-gray-600 text-[10px]">
                          CHASSIS
                        </th>
                        <th className="px-1.5 py-1 text-right font-medium text-gray-600 text-[10px]">
                          AMOUNT
                        </th>
                        <th className="px-1.5 py-1 text-center font-medium text-gray-600 text-[10px]">
                          ACT
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {cars.map((car, carIndex) => (
                        <tr key={car._id} className="hover:bg-gray-50">
                          <td className="px-1.5 py-1 text-gray-600">
                            {carIndex + 1}
                          </td>
                          <td className="px-1.5 py-1 text-gray-600 whitespace-nowrap">
                            {formatDate(car.date)}
                          </td>
                          <td className="px-1.5 py-1 font-medium">
                            {car.stockNo}
                          </td>
                          <td className="px-1.5 py-1">{car.companyName}</td>
                          <td className="px-1.5 py-1">{car.name}</td>
                          <td className="px-1.5 py-1 font-mono text-[10px]">
                            {car.chassis}
                          </td>
                          <td className="px-1.5 py-1 text-right text-green-600 font-semibold whitespace-nowrap">
                            R{(car.amount || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-1.5 py-1 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteCar(car._id, carrierIdStr);
                              }}
                              className="text-red-600 hover:text-red-800"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100">
                      <tr>
                        <td
                          colSpan="6"
                          className="px-1.5 py-1 text-right font-semibold text-xs"
                        >
                          Total:
                        </td>
                        <td className="px-1.5 py-1 text-right text-green-600 font-bold text-xs">
                          R{carsTotal.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
