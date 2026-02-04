"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Trash2, DollarSign, Truck, Edit, Calendar } from "lucide-react";
import { formatDate } from "@/app/lib/utils/dateFormat";
import ExpenseForm from "../components/ExpenseForm";
import CarForm from "../components/CarForm";
import { deleteCar } from "@/app/lib/carriers-actions/cars";
import { getAllCompanies } from "@/app/lib/carriers-actions/companies";

const CATEGORY_LABELS = {
  fuel: "Fuel",
  driver_rent: "Driver Rent",
  taxes: "Taxes",
  tool_taxes: "Tool Taxes",
  on_road: "On Road",
  others: "Others",
  maintenance: "Maintenance",
  tyre: "Tyre",
};

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tripId = params.tripId;

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showCarForm, setShowCarForm] = useState(false);

  // Fetch trip data (includes expenses and cars in one call) - Priority query
  const { data: tripData, isLoading: tripLoading } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const response = await fetch(`/api/carriers/${tripId}`);
      if (!response.ok) throw new Error("Failed to fetch trip");
      return response.json();
    },
    enabled: !!tripId,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

  // Fetch companies for CarForm - Non-blocking, can load in background
  const { data: companiesData } = useQuery({
    queryKey: ["companies"],
    queryFn: getAllCompanies,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    enabled: showCarForm, // Only fetch when needed
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId) => {
      const response = await fetch(`/api/carriers/${tripId}/expenses/${expenseId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete expense");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
      // Invalidate driver rent queries so modal shows updated data
      queryClient.invalidateQueries({ queryKey: ["driverRentPayments"] });
    },
  });

  const deleteCarMutation = useMutation({
    mutationFn: deleteCar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
    },
  });

  const syncCarsDateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/carriers/${tripId}/sync-cars-date`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to sync cars date");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
    },
  });

  const handleDeleteExpense = (expenseId) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    deleteExpenseMutation.mutate(expenseId);
  };

  const handleDeleteCar = (carId) => {
    if (!confirm("Are you sure you want to delete this car?")) return;
    deleteCarMutation.mutate(carId);
  };

  const handleCloseExpenseForm = async () => {
    setShowExpenseForm(false);
    // Refetch immediately to show updated data
    queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    await queryClient.refetchQueries({ queryKey: ["trip", tripId] });
    queryClient.invalidateQueries({ queryKey: ["carriers"] });
    // Invalidate driver rent queries so modal shows updated data
    queryClient.invalidateQueries({ queryKey: ["driverRentPayments"] });
  };

  const handleCloseCarForm = async () => {
    setShowCarForm(false);
    // Refetch immediately to show updated data
    queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    await queryClient.refetchQueries({ queryKey: ["trip", tripId] });
    queryClient.invalidateQueries({ queryKey: ["carriers"] });
  };

  const trip = tripData?.carrier;
  const expenses = tripData?.expenses || [];
  const cars = tripData?.cars || [];
  const companies = companiesData?.companies || [];
  
  // Use pre-calculated totals from API if available, otherwise calculate
  const totalExpense = tripData?.totalExpense ?? expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const totalAmount = tripData?.totalAmount ?? cars.reduce((sum, car) => sum + (car.amount || 0), 0);
  const profit = tripData?.profit ?? (totalAmount - totalExpense);

  const loading = tripLoading;

  // Show skeleton/loading state faster
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-3"></div>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded"></div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-3"></div>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Trip not found</p>
          <button
            onClick={() => router.push("/carrier-trips")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Trips
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-4">
        {/* Compact Header with Summary */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-800 mb-2">
                {trip.tripNumber || trip.name || "N/A"}
              </h1>
              <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                <div><span className="font-medium">Date:</span> {formatDate(trip.date)}</div>
                {trip.truckData?.name && (
                  <div>
                    <span className="font-medium">Truck:</span> {trip.truckData.name}
                    {trip.truckData.number && ` (${trip.truckData.number})`}
                  </div>
                )}
                {trip.carrierName && !trip.truckData?.name && (
                  <div><span className="font-medium">Carrier:</span> {trip.carrierName}</div>
                )}
                {trip.truckData?.drivers && trip.truckData.drivers.length > 0 ? (
                  <div>
                    <span className="font-medium">Drivers:</span>{" "}
                    {trip.truckData.drivers.map(d => d.name).join(", ")}
                  </div>
                ) : trip.driverName ? (
                  <div><span className="font-medium">Driver:</span> {trip.driverName}</div>
                ) : null}
                {trip.meterReadingAtTrip && (
                  <div>
                    <span className="font-medium">Meter at Trip:</span> {trip.meterReadingAtTrip.toLocaleString("en-US")} km
                  </div>
                )}
                {trip.distance && (
                  <div>
                    <span className="font-medium">Distance Traveled:</span> {trip.distance.toLocaleString("en-US")} km
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => router.push("/carrier-trips")}
              className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1 text-sm"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          </div>

          {/* Compact Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-green-50 p-3 rounded">
              <p className="text-[10px] text-gray-600 mb-0.5">Revenue</p>
              <p className="text-lg font-bold text-green-600">
                R{totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-red-50 p-3 rounded">
              <p className="text-[10px] text-gray-600 mb-0.5">Expenses</p>
              <p className="text-lg font-bold text-red-600">
                R{totalExpense.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className={`p-3 rounded ${profit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
              <p className="text-[10px] text-gray-600 mb-0.5">Profit</p>
              <p className={`text-lg font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                R{profit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-[10px] text-gray-600 mb-0.5">Cars</p>
              <p className="text-lg font-bold text-gray-800">{cars.length}</p>
            </div>
            {trip.meterReadingAtTrip && (
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-[10px] text-gray-600 mb-0.5">Meter at Trip</p>
                <p className="text-lg font-bold text-blue-600">
                  {trip.meterReadingAtTrip.toLocaleString("en-US")} km
                </p>
              </div>
            )}
            {trip.distance && (
              <div className="bg-purple-50 p-3 rounded">
                <p className="text-[10px] text-gray-600 mb-0.5">Distance</p>
                <p className="text-lg font-bold text-purple-600">
                  {trip.distance.toLocaleString("en-US")} km
                </p>
              </div>
            )}
          </div>

          {/* Compact Details and Notes */}
          {(trip.details || trip.notes) && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              {trip.details && (
                <div className="mb-2">
                  <p className="text-[10px] font-medium text-gray-600 mb-0.5">Details:</p>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{trip.details}</p>
                </div>
              )}
              {trip.notes && (
                <div>
                  <p className="text-[10px] font-medium text-gray-600 mb-0.5">Notes:</p>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{trip.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Expenses and Cars Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Expenses Section - Table View */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-semibold text-gray-800">Expenses</h2>
              <button
                onClick={() => setShowExpenseForm(true)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1.5 text-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {expenses.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No expenses yet. Click "Add" to add expenses.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">#</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Date</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Category</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Driver</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Details</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Liters</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Price/L</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Meter (km)</th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-600">Amount</th>
                      <th className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {expenses.map((expense, index) => (
                      <tr key={expense._id} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 text-gray-600">{index + 1}</td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap text-[10px]">
                          {formatDate(expense.date)}
                        </td>
                        <td className="px-2 py-1.5 text-[10px]">
                          {CATEGORY_LABELS[expense.category] || expense.category}
                        </td>
                        <td className="px-2 py-1.5 text-[10px]">
                          {expense.category === "driver_rent" && (expense.driverRentDriver?.name || expense.driver?.name)
                            ? (expense.driverRentDriver?.name || expense.driver?.name)
                            : "-"}
                        </td>
                        <td className="px-2 py-1.5 text-[10px] max-w-[150px] truncate" title={expense.details || ""}>
                          {expense.details || "-"}
                        </td>
                        <td className="px-2 py-1.5 text-[10px]">
                          {expense.category === "fuel" && expense.liters ? expense.liters : "-"}
                        </td>
                        <td className="px-2 py-1.5 text-[10px]">
                          {expense.category === "fuel" && expense.pricePerLiter ? `R${expense.pricePerLiter.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-2 py-1.5 text-[10px]">
                          {expense.category === "maintenance" && expense.meterReading 
                            ? expense.meterReading.toLocaleString("en-US") 
                            : "-"}
                        </td>
                        <td className="px-2 py-1.5 text-right text-red-600 font-semibold text-[10px]">
                          R{expense.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setEditingExpense(expense);
                                setShowExpenseForm(true);
                              }}
                              className="text-blue-600 hover:text-blue-800"
                              title="Edit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
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
                  <tfoot className="bg-gray-100 sticky bottom-0">
                    <tr>
                      <td colSpan="7" className="px-2 py-1.5 text-right font-semibold text-[10px]">
                        Total:
                      </td>
                      <td className="px-2 py-1.5 text-right text-red-600 font-bold text-[10px]">
                        R{totalExpense.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Cars Section - Compact */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-semibold text-gray-800">Cars ({cars.length})</h2>
              <div className="flex gap-2">
                {cars.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm(`Copy trip date (${formatDate(trip.date)}) to all ${cars.length} cars?`)) {
                        syncCarsDateMutation.mutate();
                      }
                    }}
                    disabled={syncCarsDateMutation.isPending}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm"
                    title="Copy trip date to all cars"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {syncCarsDateMutation.isPending ? "Syncing..." : "Sync Date"}
                  </button>
                )}
                <button
                  onClick={() => setShowCarForm(true)}
                  className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1.5 text-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            </div>
            {cars.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <Truck className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No cars in this trip.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">#</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Date</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Stock</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Company</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Name</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">Chassis</th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-600">Amount</th>
                      <th className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {cars.map((car, index) => (
                      <tr key={car._id} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 text-gray-600">{index + 1}</td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap text-[10px]">
                          {formatDate(car.date)}
                        </td>
                        <td className="px-2 py-1.5 font-medium text-[10px]">{car.stockNo}</td>
                        <td className="px-2 py-1.5 text-[10px]">{car.companyName}</td>
                        <td className="px-2 py-1.5 text-[10px]">{car.name}</td>
                        <td className="px-2 py-1.5 font-mono text-[9px]">{car.chassis}</td>
                        <td className="px-2 py-1.5 text-right text-green-600 font-semibold text-[10px]">
                          R{(car.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => handleDeleteCar(car._id)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 sticky bottom-0">
                    <tr>
                      <td colSpan="6" className="px-2 py-1.5 text-right font-semibold text-[10px]">
                        Total:
                      </td>
                      <td className="px-2 py-1.5 text-right text-green-600 font-bold text-[10px]">
                        R{totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expense Form Modal */}
      {showExpenseForm && trip && (
        <ExpenseForm
          carrierId={tripId}
          expense={editingExpense}
          trip={trip}
          onClose={() => {
            setShowExpenseForm(false);
            setEditingExpense(null);
            handleCloseExpenseForm();
          }}
        />
      )}

      {/* Car Form Modal */}
      {showCarForm && trip && (
        <CarForm
          carrier={trip}
          companies={companies}
          onClose={handleCloseCarForm}
        />
      )}
    </div>
  );
}
