"use client";

import { useState } from "react";
import React from "react";
import { useSearchParams } from "next/navigation";
import { Plus, ChevronDown, ChevronRight, Edit, Trash2 } from "lucide-react";
import CarrierTripForm from "./CarrierTripForm";
import CarForm from "./CarForm";
import { deleteCar } from "@/app/lib/carriers-actions/cars";
import { toggleCarrierActiveStatus } from "@/app/lib/carriers-actions/carriers";
import { useRouter } from "next/navigation";
import { formatDate } from "@/app/lib/utils/dateFormat";

export default function SimpleCarriersTable({
  carriers,
  companies,
  users = [],
  pagination,
  isSuperAdmin = false,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expandedTrips, setExpandedTrips] = useState(new Set());
  const [showTripForm, setShowTripForm] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState(null);
  const [carrierCars, setCarrierCars] = useState({});
  const [showCarForm, setShowCarForm] = useState({});

  const toggleTrip = async (carrierId) => {
    const carrierIdStr = carrierId.toString();
    const newExpanded = new Set(expandedTrips);
    if (newExpanded.has(carrierIdStr)) {
      newExpanded.delete(carrierIdStr);
    } else {
      newExpanded.add(carrierIdStr);
      // Fetch cars for this carrier if not already loaded
      if (!carrierCars[carrierIdStr]) {
        try {
          // Build query params with current filters
          const params = new URLSearchParams();
          const company = searchParams.get("company");
          const startDate = searchParams.get("startDate");
          const endDate = searchParams.get("endDate");
          
          if (company) params.set("company", company);
          if (startDate) params.set("startDate", startDate);
          if (endDate) params.set("endDate", endDate);
          
          const queryString = params.toString();
          const url = `/api/carriers/${carrierIdStr}/cars${queryString ? `?${queryString}` : ""}`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            setCarrierCars({ ...carrierCars, [carrierIdStr]: data.cars });
          } else {
            console.error("Failed to fetch cars:", response.statusText);
          }
        } catch (error) {
          console.error("Error fetching cars:", error);
        }
      }
    }
    setExpandedTrips(newExpanded);
  };

  const handleDeleteCar = async (carId, carrierId) => {
    if (!confirm("Are you sure you want to delete this car?")) return;
    const result = await deleteCar(carId);
    if (result.success) {
      router.refresh();
      // Remove from local state
      if (carrierCars[carrierId]) {
        setCarrierCars({
          ...carrierCars,
          [carrierId]: carrierCars[carrierId].filter((car) => car._id !== carId),
        });
      }
    }
  };

  const handleToggleActive = async (e, carrierId, currentStatus) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("Toggle active clicked", { carrierId, currentStatus });
    
    // Treat undefined/null as active (true) for backward compatibility
    const isCurrentlyActive = currentStatus !== false;
    const action = isCurrentlyActive ? "inactive" : "active";
    
    try {
      console.log("Calling toggleCarrierActiveStatus with:", carrierId);
      const result = await toggleCarrierActiveStatus(carrierId);
      console.log("Toggle result:", result);
      
      if (result.success) {
        router.refresh();
      } else {
        console.error("Toggle failed:", result.error);
        alert(result.error || "Failed to update trip status");
      }
    } catch (error) {
      console.error("Error toggling active status:", error);
      alert("An error occurred while updating trip status: " + error.message);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-2 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-800">Carrier Trips</h2>
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

        {carriers.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            <p>No trips found. Create your first trip to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-gray-600 text-[10px] w-6"></th>
                  <th className="px-2 py-1.5 text-left font-medium text-gray-600 text-[10px]">TRIP/COMPANY</th>
                  {isSuperAdmin && (
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600 text-[10px]">USER</th>
                  )}
                  <th className="px-2 py-1.5 text-left font-medium text-gray-600 text-[10px]">DATE</th>
                  <th className="px-2 py-1.5 text-right font-medium text-gray-600 text-[10px]">CARS</th>
                  <th className="px-2 py-1.5 text-right font-medium text-gray-600 text-[10px]">TOTAL</th>
                  <th className="px-2 py-1.5 text-right font-medium text-gray-600 text-[10px]">EXPENSE</th>
                  <th className="px-2 py-1.5 text-right font-medium text-gray-600 text-[10px]">PROFIT</th>
                  <th className="px-2 py-1.5 text-center font-medium text-gray-600 text-[10px]">ACT</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {carriers.map((carrier) => {
                  const carrierIdStr = carrier._id.toString();
                  const isExpanded = expandedTrips.has(carrierIdStr);
                  // Use cars from carrier data if available (from filtered query), otherwise fetch
                  const cars = carrierCars[carrierIdStr] || carrier.cars || [];
                  const carsTotal = cars.reduce((sum, car) => sum + (car.amount || 0), 0);
                  const profit = (carrier.profit || 0);

                  return (
                    <React.Fragment key={carrier._id}>
                      <tr
                        className={`hover:bg-gray-50 cursor-pointer ${(carrier.isActive === false) ? 'opacity-60 bg-gray-100' : ''}`}
                        onClick={() => toggleTrip(carrierIdStr)}
                      >
                        <td className="px-2 py-1.5 text-gray-400">
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </td>
                        <td className="px-2 py-1.5 font-semibold text-gray-900">
                          <div className="flex items-center gap-1">
                            {carrier.tripNumber || carrier.name || 'N/A'}
                            {carrier.type === 'company' && (
                              <span className="text-[8px] text-gray-500 bg-gray-100 px-1 py-0.5 rounded">CO</span>
                            )}
                            {carrier.type === 'trip' && (
                              <span className="text-[8px] text-gray-500 bg-gray-100 px-1 py-0.5 rounded">TR</span>
                            )}
                            {(carrier.isActive === false) && (
                              <span className="text-[8px] text-red-600 bg-red-100 px-1 py-0.5 rounded">INACTIVE</span>
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
                        <td className="px-2 py-1.5 text-right text-gray-700">
                          {carrier.carCount || 0}
                        </td>
                        <td className="px-2 py-1.5 text-right text-green-600 font-semibold whitespace-nowrap">
                          ${(carrier.totalAmount || 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-2 py-1.5 text-right text-red-600 whitespace-nowrap">
                          ${(carrier.totalExpense || 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className={`px-2 py-1.5 text-right font-semibold whitespace-nowrap ${
                          profit >= 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          ${profit.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td
                          className="px-2 py-1.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setEditingCarrier(carrier);
                                setShowTripForm(true);
                              }}
                              className="text-gray-600 hover:text-gray-800"
                              title="Edit Trip"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {carrier.type === 'trip' && (
                              <button
                                type="button"
                                onClick={(e) => handleToggleActive(e, carrier._id, carrier.isActive)}
                                className={`px-1.5 py-0.5 text-[9px] font-medium rounded border transition-colors ${
                                  (carrier.isActive === false) 
                                    ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200' 
                                    : 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
                                }`}
                                title={`Click to mark as ${(carrier.isActive === false) ? 'Active' : 'Inactive'}`}
                              >
                                {(carrier.isActive === false) ? 'Inactive' : 'Active'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Cars Table */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={isSuperAdmin ? 9 : 8} className="px-0 py-0 bg-gray-50">
                            <div className="px-2 py-2">
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="text-xs font-semibold text-gray-700">
                                  Cars ({cars.length})
                                </h4>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowCarForm({ ...showCarForm, [carrierIdStr]: true });
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
                                      {cars.map((car, index) => (
                                        <tr key={car._id} className="hover:bg-gray-50">
                                          <td className="px-1.5 py-1 text-gray-600">
                                            {index + 1}
                                          </td>
                                          <td className="px-1.5 py-1 text-gray-600 whitespace-nowrap">
                                            {formatDate(car.date)}
                                          </td>
                                          <td className="px-1.5 py-1 font-medium">
                                            {car.stockNo}
                                          </td>
                                          <td className="px-1.5 py-1">
                                            {car.companyName}
                                          </td>
                                          <td className="px-1.5 py-1">{car.name}</td>
                                          <td className="px-1.5 py-1 font-mono text-[10px]">
                                            {car.chassis}
                                          </td>
                                          <td className="px-1.5 py-1 text-right text-green-600 font-semibold whitespace-nowrap">
                                            ${(car.amount || 0).toLocaleString("en-US", {
                                              minimumFractionDigits: 2,
                                            })}
                                          </td>
                                          <td className="px-1.5 py-1 text-center">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteCar(car._id, carrierIdStr);
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
                                          ${carsTotal.toLocaleString("en-US", {
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

                      {/* Car Form Modal */}
                      {showCarForm[carrierIdStr] && (
                        <CarForm
                          carrier={carrier}
                          companies={companies}
                          users={users}
                          onClose={async () => {
                            setShowCarForm({ ...showCarForm, [carrierIdStr]: false });
                            // Refetch cars for this carrier immediately
                            try {
                              const params = new URLSearchParams();
                              const company = searchParams.get("company");
                              const startDate = searchParams.get("startDate");
                              const endDate = searchParams.get("endDate");
                              
                              if (company) params.set("company", company);
                              if (startDate) params.set("startDate", startDate);
                              if (endDate) params.set("endDate", endDate);
                              
                              const queryString = params.toString();
                              const url = `/api/carriers/${carrierIdStr}/cars${queryString ? `?${queryString}` : ""}`;
                              const response = await fetch(url);
                              if (response.ok) {
                                const data = await response.json();
                                setCarrierCars({ ...carrierCars, [carrierIdStr]: data.cars });
                              }
                            } catch (error) {
                              console.error("Error refetching cars:", error);
                            }
                            // Also refresh the page to update carrier counts
                            router.refresh();
                          }}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total > 0 && (
          <div className="p-3 border-t bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-xs text-gray-600">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total} trips
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Page size:</label>
              <select
                value={pagination.limit}
                onChange={(e) => {
                  const params = new URLSearchParams(window.location.search);
                  params.set("limit", e.target.value);
                  params.set("page", "1"); // Reset to first page
                  router.push(`/carriers?${params.toString()}`);
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
                    router.push(`/carriers?${params.toString()}`);
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
                    router.push(`/carriers?${params.toString()}`);
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
      </div>

      {showTripForm && (
        <CarrierTripForm
          carrier={editingCarrier}
          users={users}
          onClose={() => {
            setShowTripForm(false);
            setEditingCarrier(null);
            // Refresh immediately to show new trip
            router.refresh();
          }}
        />
      )}
    </>
  );
}
