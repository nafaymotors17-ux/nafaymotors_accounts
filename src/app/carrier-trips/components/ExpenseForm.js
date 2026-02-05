"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { getAllDrivers } from "@/app/lib/carriers-actions/drivers";

const CATEGORIES = [
  { value: "fuel", label: "Fuel" },
  { value: "driver_rent", label: "Driver Rent" },
  { value: "taxes", label: "Taxes" },
  { value: "tool_taxes", label: "Tool Taxes" },
  { value: "on_road", label: "On Road" },
  { value: "others", label: "Others" },
];

export default function ExpenseForm({ carrierId, expense, trip, onClose }) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [category, setCategory] = useState(expense?.category || "fuel");
  const [amount, setAmount] = useState(expense?.amount?.toString() || "");
  const [details, setDetails] = useState(expense?.details || "");
  const [liters, setLiters] = useState(expense?.liters?.toString() || "");
  const [pricePerLiter, setPricePerLiter] = useState(expense?.pricePerLiter?.toString() || "");
  const [driverId, setDriverId] = useState(
    expense?.driverRentDriver?.toString() || expense?.driverRentDriver?._id?.toString() || expense?.driver?.toString() || expense?.driver?._id?.toString() || ""
  );
  const [date, setDate] = useState(
    expense?.date ? new Date(expense.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
  );

  // Get drivers from truck (if trip has truck with drivers)
  const truckDrivers = trip?.truckData?.drivers || [];

  // Calculate amount for fuel expenses
  useEffect(() => {
    if (category === "fuel" && liters && pricePerLiter) {
      const calculated = parseFloat(liters) * parseFloat(pricePerLiter);
      if (!isNaN(calculated)) {
        setAmount(calculated.toFixed(2));
      }
    }
    // Clear driver when switching away from driver_rent
    if (category !== "driver_rent" && driverId) {
      setDriverId("");
    }
    // Auto-select driver if truck has only one driver and we're creating a new expense
    if (category === "driver_rent" && !expense && truckDrivers.length === 1 && !driverId) {
      const singleDriver = truckDrivers[0];
      setDriverId(singleDriver._id?.toString() || singleDriver.toString());
    }
  }, [category, liters, pricePerLiter, truckDrivers, expense]);

  const createExpenseMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch(`/api/carriers/${carrierId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create expense");
      }
      return response.json();
    },
    onSuccess: async () => {
      // Invalidate and refetch queries to refresh the trip data immediately
      queryClient.invalidateQueries({ queryKey: ["trip", carrierId] });
      await queryClient.refetchQueries({ queryKey: ["trip", carrierId] });
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
      queryClient.invalidateQueries({ queryKey: ["driverRentPayments"] });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch(`/api/carriers/${carrierId}/expenses/${expense._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update expense");
      }
      return response.json();
    },
    onSuccess: async () => {
      // Invalidate and refetch queries to refresh the trip data immediately
      queryClient.invalidateQueries({ queryKey: ["trip", carrierId] });
      await queryClient.refetchQueries({ queryKey: ["trip", carrierId] });
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
      queryClient.invalidateQueries({ queryKey: ["driverRentPayments"] });
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const expenseData = {
        category,
        amount: parseFloat(amount) || 0,
        details: details.trim(),
        date,
      };

      if (category === "fuel") {
        if (liters) expenseData.liters = parseFloat(liters);
        if (pricePerLiter) expenseData.pricePerLiter = parseFloat(pricePerLiter);
      }

      if (category === "driver_rent") {
        if (!driverId) {
          setError("Please select a driver for driver rent expense");
          setIsSubmitting(false);
          return;
        }
        expenseData.driver = driverId;
      }

      if (expense) {
        await updateExpenseMutation.mutateAsync(expenseData);
      } else {
        await createExpenseMutation.mutateAsync(expenseData);
      }

      onClose();
    } catch (err) {
      setError(err.message || "Failed to save expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">
            {expense ? "Edit Expense" : "Add Expense"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isSubmitting}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {category === "fuel" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Liters
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={liters}
                    onChange={(e) => setLiters(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price per Liter (R)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={pricePerLiter}
                    onChange={(e) => setPricePerLiter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="bg-blue-50 p-2 rounded text-xs text-blue-700">
                <strong>Calculated Amount:</strong> R
                {liters && pricePerLiter
                  ? (parseFloat(liters) * parseFloat(pricePerLiter)).toFixed(2)
                  : "0.00"}
              </div>
            </>
          )}

          {category === "driver_rent" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Driver *
              </label>
              {truckDrivers.length > 0 ? (
                <>
                  <select
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">Select a driver</option>
                    {truckDrivers.map((driver) => {
                      const driverIdValue = driver._id?.toString() || driver.toString();
                      const driverName = typeof driver === 'object' ? driver.name : driver;
                      return (
                        <option key={driverIdValue} value={driverIdValue}>
                          {driverName}
                        </option>
                      );
                    })}
                  </select>
                  {truckDrivers.length === 1 && !expense && (
                    <p className="text-xs text-blue-600 mt-1">
                      Auto-selected: {typeof truckDrivers[0] === 'object' ? truckDrivers[0].name : truckDrivers[0]}
                    </p>
                  )}
                  {truckDrivers.length > 1 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Select from {truckDrivers.length} drivers assigned to this truck
                    </p>
                  )}
                </>
              ) : (
                <>
                  <select
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-red-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-red-50"
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">No drivers assigned to truck</option>
                  </select>
                  <p className="text-xs text-red-500 mt-1">
                    This trip's truck has no drivers assigned. Please assign drivers to the truck first.
                  </p>
                </>
              )}
            </div>
          )}


          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (R) *
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
              required
              disabled={isSubmitting || (category === "fuel" && liters && pricePerLiter)}
            />
            {category === "fuel" && liters && pricePerLiter && (
              <p className="text-xs text-gray-500 mt-1">
                Amount is calculated from liters and price per liter
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Details
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows="3"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Enter expense details..."
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : expense ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
