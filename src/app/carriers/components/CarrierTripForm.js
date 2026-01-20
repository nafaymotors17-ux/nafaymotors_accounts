"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCarrier, updateCarrierExpense } from "@/app/lib/carriers-actions/carriers";
import { useUser } from "@/app/components/UserContext";
import { X } from "lucide-react";

export default function CarrierTripForm({ carrier, users = [], onClose }) {
  const { user } = useUser();
  const [selectedUserId, setSelectedUserId] = useState("");
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.target);

    try {
      let result;
      if (carrier) {
        // Update expense only
        const expense = formData.get("totalExpense");
        result = await updateCarrierExpense(carrier._id, expense);
      } else {
        // Create new carrier
        result = await createCarrier(formData);
      }

      if (result.success) {
        if (result.warning) {
          // Show warning but don't block - user can proceed
          alert(`Warning: ${result.warning}`);
        }
        // Close modal - onClose callback will handle refresh
        onClose();
      } else {
        setError(result.error || "Failed to save");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">
            {carrier ? "Edit Trip Expense" : "Create New Trip"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {!carrier && (
            <>
              {user?.role === "super_admin" && users.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Create for User (Optional)
                  </label>
                  <select
                    name="userId"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    disabled={isSubmitting}
                  >
                    <option value="">Your own account</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.username} {u.role === "super_admin" ? "(Admin)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Leave empty to create for yourself</p>
                </div>
              )}

              <input type="hidden" name="type" value="trip" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trip Number *
                </label>
                <input
                  type="text"
                  name="tripNumber"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., TRIP-001"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Companies are created automatically when you add cars to trips
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  disabled={isSubmitting}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Expense
            </label>
            <input
              type="number"
              step="0.01"
              name="totalExpense"
              defaultValue={carrier?.totalExpense || "0"}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              disabled={isSubmitting}
            />
          </div>

          {!carrier && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Optional notes..."
                disabled={isSubmitting}
              />
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : carrier ? "Update Expense" : "Create Trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
