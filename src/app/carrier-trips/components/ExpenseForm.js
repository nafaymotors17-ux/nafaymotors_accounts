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

export default function ExpenseForm({ carrierId, expense, trip, onClose, onNotify }) {
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
    onMutate: async (newExpenseData) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["trip", carrierId] });
      
      // Snapshot previous value
      const previousTripData = queryClient.getQueryData(["trip", carrierId]);
      
      // Get driver name from trip prop if available
      let driverName = "";
      if (newExpenseData.driver && trip?.truckData?.drivers) {
        const driver = trip.truckData.drivers.find(
          d => String(d._id) === String(newExpenseData.driver)
        );
        driverName = driver?.name || "";
      }
      
      // Create optimistic expense object
      const optimisticExpense = {
        _id: `temp-${Date.now()}`,
        category: newExpenseData.category,
        amount: newExpenseData.amount || 0,
        details: newExpenseData.details || "",
        date: newExpenseData.date,
        liters: newExpenseData.liters,
        pricePerLiter: newExpenseData.pricePerLiter,
        driverRentDriver: newExpenseData.driver ? { _id: newExpenseData.driver, name: driverName } : undefined,
        driver: newExpenseData.driver ? { _id: newExpenseData.driver, name: driverName } : undefined,
      };
      
      // Optimistically update cache - add expense immediately
      if (previousTripData) {
        queryClient.setQueryData(["trip", carrierId], (old) => {
          if (!old) return old;
          return {
            ...old,
            expenses: [optimisticExpense, ...(old.expenses || [])],
            totalExpense: (old.totalExpense || 0) + (optimisticExpense.amount || 0),
          };
        });
      }
      
      return { previousTripData };
    },
    onError: (err, newExpenseData, context) => {
      // Rollback on error
      if (context?.previousTripData) {
        queryClient.setQueryData(["trip", carrierId], context.previousTripData);
      }
      const message = err.message || "Failed to create expense. Changes have been reverted.";
      setError(message);
      setIsSubmitting(false);
      onNotify?.("error", message);
    },
    onSuccess: (data) => {
      // Replace optimistic expense with real one from server (no refetch)
      queryClient.setQueryData(["trip", carrierId], (old) => {
        if (!old) return old;
        const expenses = (old.expenses || []).filter(exp => !exp._id?.startsWith("temp-"));
        return {
          ...old,
          expenses: [data.expense, ...expenses],
        };
      });
      onNotify?.("success", "Expense added");
      // Invalidate other lists in background (trip stays without refresh)
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
    onMutate: async (updatedExpenseData) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["trip", carrierId] });
      
      // Snapshot previous value
      const previousTripData = queryClient.getQueryData(["trip", carrierId]);
      
      // Optimistically update cache - update expense immediately
      if (previousTripData) {
        queryClient.setQueryData(["trip", carrierId], (old) => {
          if (!old) return old;
          const expenseIdStr = String(expense._id);
          const oldExpense = old.expenses?.find(exp => String(exp._id) === expenseIdStr);
          const oldAmount = oldExpense?.amount || 0;
          const newAmount = updatedExpenseData.amount || 0;
          
          return {
            ...old,
            expenses: old.expenses?.map(exp => {
              if (String(exp._id) === expenseIdStr) {
                return {
                  ...exp,
                  ...updatedExpenseData,
                  _id: exp._id, // Preserve original ID
                };
              }
              return exp;
            }) || [],
            totalExpense: old.totalExpense !== undefined
              ? old.totalExpense - oldAmount + newAmount
              : old.totalExpense,
          };
        });
      }
      
      return { previousTripData };
    },
    onError: (err, updatedExpenseData, context) => {
      if (context?.previousTripData) {
        queryClient.setQueryData(["trip", carrierId], context.previousTripData);
      }
      const message = err.message || "Failed to update expense. Changes have been reverted.";
      setError(message);
      setIsSubmitting(false);
      onNotify?.("error", message);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["trip", carrierId], (old) => {
        if (!old) return old;
        const expenseIdStr = String(expense._id);
        return {
          ...old,
          expenses: old.expenses?.map(exp =>
            String(exp._id) === expenseIdStr ? data.expense : exp
          ) || [],
        };
      });
      onNotify?.("success", "Expense updated");
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
      queryClient.invalidateQueries({ queryKey: ["driverRentPayments"] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

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
      updateExpenseMutation.mutate(expenseData, {
        onSettled: () => setIsSubmitting(false),
      });
    } else {
      createExpenseMutation.mutate(expenseData, {
        onSettled: () => setIsSubmitting(false),
      });
    }
    // Close immediately: UI already updated optimistically; success/error toasts handle result
    onClose();
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
            disabled={isSubmitting || createExpenseMutation.isPending || updateExpenseMutation.isPending}
            title={isSubmitting || createExpenseMutation.isPending || updateExpenseMutation.isPending ? "Please wait for the operation to complete" : "Close"}
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
              disabled={isSubmitting || createExpenseMutation.isPending || updateExpenseMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || createExpenseMutation.isPending || updateExpenseMutation.isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {(isSubmitting || createExpenseMutation.isPending || updateExpenseMutation.isPending) ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Saving...</span>
                </>
              ) : (
                expense ? "Update" : "Add"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
