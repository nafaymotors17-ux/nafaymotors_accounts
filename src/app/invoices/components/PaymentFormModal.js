"use client";

import { useState } from "react";
import { X, DollarSign } from "lucide-react";

export default function PaymentFormModal({
  invoice,
  getPaymentInfo,
  onClose,
  onRecordPayment,
  isPending,
}) {
  const [formData, setFormData] = useState({
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const paymentInfo = invoice ? getPaymentInfo(invoice) : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      alert("Please enter a valid payment amount");
      return;
    }

    const paymentAmount = parseFloat(formData.amount);
    if (paymentAmount > paymentInfo.remainingBalance) {
      alert(
        `Payment amount cannot exceed remaining balance of R${paymentInfo.remainingBalance.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })}`
      );
      return;
    }

    onRecordPayment(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">Record Payment</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Amount *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={paymentInfo?.remainingBalance || 0}
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Remaining balance: R
              {paymentInfo?.remainingBalance.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              }) || "0.00"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Date *
            </label>
            <input
              type="date"
              value={formData.paymentDate}
              onChange={(e) =>
                setFormData({ ...formData, paymentDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Optional payment notes..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isPending || !formData.amount}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              {isPending ? "Recording..." : "Record Payment"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
