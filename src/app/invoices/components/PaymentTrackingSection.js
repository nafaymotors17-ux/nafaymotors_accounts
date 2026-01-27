"use client";

import { Trash2, Plus } from "lucide-react";
import { formatDate } from "@/app/lib/utils/dateFormat";

export default function PaymentTrackingSection({
  invoice,
  paymentInfo,
  getPaymentStatusBadge,
  onRecordPayment,
  onDeletePayment,
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 p-3 border-b flex justify-between items-center">
        <h3 className="font-semibold text-gray-800 text-sm">Payment Tracking</h3>
        {paymentInfo.remainingBalance > 0 && (
          <button
            onClick={onRecordPayment}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1 text-xs"
          >
            <Plus className="w-3 h-3" />
            Record Payment
          </button>
        )}
      </div>
      <div className="p-4 space-y-4">
        {/* Payment Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Amount</p>
            <p className="text-lg font-bold text-green-600">
              R{invoice.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Paid</p>
            <p className="text-lg font-bold text-blue-600">
              R{paymentInfo.totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Remaining Balance</p>
            <p
              className={`text-lg font-bold ${
                paymentInfo.remainingBalance > 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              R{paymentInfo.remainingBalance.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        {/* Payment Status */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Status:</span>
          {getPaymentStatusBadge(paymentInfo.paymentStatus, paymentInfo.remainingBalance)}
          {invoice.dueDate && (
            <span className="text-xs text-gray-500 ml-4">
              Due: {formatDate(invoice.dueDate)}
            </span>
          )}
        </div>

        {/* Payment History */}
        {paymentInfo.payments.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Payment History</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                      Date
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                      Notes
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                      Amount
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paymentInfo.payments.map((payment) => (
                    <tr key={payment._id}>
                      <td className="px-3 py-2 text-gray-600">
                        {formatDate(payment.paymentDate)}
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-xs">
                        {payment.notes || "-"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-green-600">
                        R{(payment.amount || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => {
                            if (
                              confirm("Are you sure you want to delete this payment?")
                            ) {
                              onDeletePayment(invoice._id, payment._id);
                            }
                          }}
                          className="text-red-600 hover:text-red-800"
                          title="Delete Payment"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
