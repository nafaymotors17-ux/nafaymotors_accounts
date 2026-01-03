"use client";

import { createTransaction } from "@/lib/accounting-actions/transaction";
import { useState } from "react";
import {
  X,
  ArrowUpDown,
  Calendar,
  FileText,
  RefreshCw,
  Landmark,
  CheckCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function TransactionFormClient({ account, onClose }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 16);
  const [type, setType] = useState("credit");
  const [isTransfer, setIsTransfer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleFormSubmit = async (formData) => {
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      // Add hidden fields programmatically
      formData.append("type", type);
      formData.append("debitType", isTransfer ? "transfer" : "expense");

      const result = await createTransaction(formData);

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(result.message || "Transaction recorded successfully!");

        // Refresh the page to show updated balance and transactions
        setTimeout(() => {
          router.refresh();
          onClose();
        }, 1500);
      }
    } catch (err) {
      setError(
        err.message || "Failed to record transaction. Please try again."
      );
      console.error("Form submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 flex flex-col max-h-[90vh]">
        {/* Compact Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50/50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <ArrowUpDown className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                Record Transaction
              </h2>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                {account?.title || "Account"} • {account?.currency || "USD"}
              </p>
            </div>
          </div>
          {!success && (
            <button onClick={onClose}>
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Success Message */}
        {success && (
          <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-600 font-medium">{success}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg animate-in slide-in-from-top duration-300">
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        )}

        {/* Scrollable Body - Only show form if not successful */}
        {!success ? (
          <form
            action={handleFormSubmit}
            className="p-5 overflow-y-auto space-y-4"
          >
            <input type="hidden" name="accountId" value={account._id} />
            <input type="hidden" name="type" value={type} />
            <input
              type="hidden"
              name="debitType"
              value={isTransfer ? "transfer" : "expense"}
            />

            {/* Type Selection - More Compact Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setType("credit");
                  setIsTransfer(false);
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 border-2 rounded-lg transition-all text-sm font-semibold ${
                  type === "credit"
                    ? "border-green-600 bg-green-50 text-green-700"
                    : "border-gray-100 bg-gray-50 text-gray-500"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    type === "credit" ? "bg-green-600" : "bg-gray-300"
                  }`}
                />
                Credit
              </button>
              <button
                type="button"
                onClick={() => setType("debit")}
                className={`flex items-center justify-center gap-2 py-2 px-3 border-2 rounded-lg transition-all text-sm font-semibold ${
                  type === "debit"
                    ? "border-red-600 bg-red-50 text-red-700"
                    : "border-gray-100 bg-gray-50 text-gray-500"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    type === "debit" ? "bg-red-600" : "bg-gray-300"
                  }`}
                />
                Debit
              </button>
            </div>

            {/* Conditional Sub-Type for Debit */}
            {type === "debit" && (
              <div className="flex gap-4 p-2 bg-gray-50 rounded-lg border border-dashed border-gray-200 animate-in fade-in slide-in-from-top-1">
                <label className="flex items-center gap-2 cursor-pointer flex-1 justify-center">
                  <input
                    type="radio"
                    name="debitTypeRadio"
                    checked={!isTransfer}
                    onChange={() => setIsTransfer(false)}
                    className="w-3 h-3 text-blue-600"
                  />
                  <span className="text-xs font-medium text-gray-700">
                    Expense
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer flex-1 justify-center">
                  <input
                    type="radio"
                    name="debitTypeRadio"
                    checked={isTransfer}
                    onChange={() => setIsTransfer(true)}
                    className="w-3 h-3 text-blue-600"
                  />
                  <span className="text-xs font-medium text-gray-700">
                    Transfer
                  </span>
                </label>
              </div>
            )}

            {/* Main Grid: Amount & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <span>{account.currencySymbol}</span>
                  Amount *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    required
                    min="0.01"
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Date *
                </label>
                <input
                  type="datetime-local"
                  name="transactionDate"
                  defaultValue={today}
                  required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all"
                />
              </div>
            </div>

            {/* Conditional Destination */}
            {isTransfer && (
              <div className="space-y-1.5 animate-in zoom-in-95 duration-200">
                <label className="text-xs font-bold text-gray-700">
                  Destination *
                </label>
                <input
                  type="text"
                  name="destination"
                  required={isTransfer}
                  className="w-full px-3 py-2 bg-blue-50/30 border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                  placeholder="Where is the money going?"
                />
              </div>
            )}

            {/* Details */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Details *
              </label>
              <textarea
                name="details"
                rows="2"
                required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none text-sm resize-none"
                placeholder="What was this for?"
              />
            </div>

            {/* Exchange Rate - Tighter layout */}
            <div className="p-3 bg-orange-50/50 border border-orange-100 rounded-lg space-y-2">
              <label className="text-[10px] uppercase tracking-wider font-bold text-orange-800 flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" /> Exchange Rate (Optional)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.0001"
                  name="rateOfExchange"
                  min="0"
                  className="w-full px-3 py-1.5 bg-white border border-orange-200 rounded focus:ring-2 focus:ring-orange-500/20 outline-none text-sm"
                  placeholder="1.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-orange-400">
                  PER USD
                </span>
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="pt-4 border-t bg-white flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold text-white transition-all ${
                  isSubmitting
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Landmark className="w-4 h-4" />
                    Record
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          // Success state - show only the success message with auto-close countdown
          <div className="p-6 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Success!</h3>
            <p className="text-gray-600 text-center mb-6">{success}</p>
            <p className="text-xs text-gray-400 animate-pulse">
              Closing in 2 seconds...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
