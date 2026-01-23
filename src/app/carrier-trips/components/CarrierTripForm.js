"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createCarrier, updateCarrierExpense, generateNextTripNumber } from "@/app/lib/carriers-actions/carriers";
import { useUser } from "@/app/components/UserContext";
import { X, RefreshCw } from "lucide-react";
import { formatDate } from "@/app/lib/utils/dateFormat";

export default function CarrierTripForm({ carrier, users = [], onClose }) {
  const { user } = useUser();
  const [selectedUserId, setSelectedUserId] = useState("");
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [tripNumber, setTripNumber] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const detailsRef = useRef(null);
  const notesRef = useRef(null);

  // Auto-resize textareas
  const adjustTextareaHeight = (textarea) => {
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  // Auto-generate trip number on mount if creating new trip
  useEffect(() => {
    if (!carrier) {
      loadGeneratedTripNumber();
    }
  }, [carrier, selectedUserId]);

  // Load generated trip number
  const loadGeneratedTripNumber = async () => {
    setIsGenerating(true);
    try {
      const result = await generateNextTripNumber(selectedUserId || null);
      if (result.success) {
        setTripNumber(result.tripNumber);
      }
    } catch (err) {
      console.error("Error generating trip number:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (detailsRef.current) {
      adjustTextareaHeight(detailsRef.current);
    }
    if (notesRef.current) {
      adjustTextareaHeight(notesRef.current);
    }
  }, [carrier]);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.target);

    try {
      let result;
      if (carrier) {
        // Update expense, details, and notes
        result = await updateCarrierExpense(carrier._id, formData);
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
        <div className="flex justify-between items-center p-3 border-b">
          <div>
            <h2 className="text-base font-semibold">
              {carrier ? "Edit Trip" : "Create New Trip"}
            </h2>
            {carrier && (
              <div className="text-xs text-gray-600 mt-0.5">
                {carrier.tripNumber || carrier.name || "N/A"} • {formatDate(carrier.date)}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isSubmitting}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3 space-y-2.5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-2 py-1.5 rounded text-xs">
              {error}
            </div>
          )}

          {!carrier && (
            <>
              {user?.role === "super_admin" && users.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Create for User (Optional)
                  </label>
                  <select
                    name="userId"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                    disabled={isSubmitting}
                  >
                    <option value="">Your own account</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.username} {u.role === "super_admin" ? "(Admin)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <input type="hidden" name="type" value="trip" />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Trip Number *
                </label>
                <input
                  type="text"
                  name="tripNumber"
                  required
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                  placeholder="e.g., TRIP-001"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Date *
                </label>
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Carrier Name
                </label>
                <input
                  type="text"
                  name="carrierName"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                  placeholder="e.g., ABC Transport"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Driver Name
                </label>
                <input
                  type="text"
                  name="driverName"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                  placeholder="e.g., John Doe"
                  disabled={isSubmitting}
                />
              </div>
            </>
          )}

          {carrier && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Carrier Name
                </label>
                <input
                  type="text"
                  name="carrierName"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                  placeholder="e.g., ABC Transport"
                  defaultValue={carrier?.carrierName || ""}
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Driver Name
                </label>
                <input
                  type="text"
                  name="driverName"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                  placeholder="e.g., John Doe"
                  defaultValue={carrier?.driverName || ""}
                  disabled={isSubmitting}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-0.5">
              Total Expense
            </label>
            <input
              type="number"
              step="0.01"
              name="totalExpense"
              defaultValue={carrier?.totalExpense || "0"}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-0.5">
              Expense Details
            </label>
            <textarea
              ref={detailsRef}
              name="details"
              rows="2"
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md resize-none overflow-hidden"
              placeholder="What was the expense for?"
              defaultValue={carrier?.details || ""}
              disabled={isSubmitting}
              onInput={(e) => adjustTextareaHeight(e.target)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-0.5">
              Notes
            </label>
            <textarea
              ref={notesRef}
              name="notes"
              rows="2"
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md resize-none overflow-hidden"
              placeholder="Additional notes..."
              defaultValue={carrier?.notes || ""}
              disabled={isSubmitting}
              onInput={(e) => adjustTextareaHeight(e.target)}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : carrier ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
