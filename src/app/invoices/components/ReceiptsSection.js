"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Trash2, FileText, Calendar } from "lucide-react";
import {
  getReceiptsByInvoice,
  deleteReceipt,
  updateReceiptStatus,
} from "@/app/lib/invoice-actions/receipts";
import { downloadReceiptPDF } from "@/app/lib/utils/receiptPDF";
import { formatDate } from "@/app/lib/utils/dateFormat";

export default function ReceiptsSection({ invoiceId, invoice }) {
  const [receipts, setReceipts] = useState([]);

  // Fetch receipts for this invoice
  const {
    data: receiptsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["receipts", invoiceId],
    queryFn: () => getReceiptsByInvoice(invoiceId),
  });

  useEffect(() => {
    if (receiptsData?.success && receiptsData.receipts) {
      setReceipts(receiptsData.receipts);
    }
  }, [receiptsData]);

  // Delete receipt mutation
  const deleteReceiptMutation = useMutation({
    mutationFn: (receiptId) => deleteReceipt(receiptId),
    onSuccess: () => {
      refetch();
    },
  });

  // Update receipt status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ receiptId, status, sentTo }) =>
      updateReceiptStatus(receiptId, status, sentTo),
    onSuccess: () => {
      refetch();
    },
  });

  const handleDownloadReceipt = (receipt) => {
    try {
      downloadReceiptPDF(receipt, invoice);
    } catch (error) {
      console.error("Error downloading receipt:", error);
      alert("Failed to download receipt");
    }
  };

  const handleDeleteReceipt = (receiptId) => {
    if (confirm("Are you sure you want to delete this receipt?")) {
      deleteReceiptMutation.mutate(receiptId);
    }
  };

  const handleMarkAsSent = (receipt) => {
    updateStatusMutation.mutate({
      receiptId: receipt._id,
      status: "sent",
      sentTo: receipt.clientCompanyName,
    });
  };

  if (isLoading) {
    return (
      <div className="text-center py-4 text-gray-500">Loading receipts...</div>
    );
  }

  if (receipts.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          No receipts yet. Receipts will be automatically generated when
          payments are recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-800">
          Payment Receipts ({receipts.length})
        </h3>
      </div>

      <div className="space-y-3">
        {receipts.map((receipt) => (
          <div
            key={receipt._id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 rounded-lg p-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      {receipt.receiptNumber}
                    </p>
                    <p className="text-sm text-gray-600">
                      {receipt.paymentMethod} Payment
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Amount Paid</p>
                    <p className="font-semibold text-gray-800">
                      R
                      {receipt.paymentAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Payment Date</p>
                    <div className="flex items-center gap-2 text-gray-800">
                      <Calendar className="w-4 h-4" />
                      <p className="font-semibold">
                        {formatDate(receipt.paymentDate)}
                      </p>
                    </div>
                  </div>
                  {receipt.excessAmount > 0 && (
                    <div>
                      <p className="text-gray-600">Added to Credit</p>
                      <p className="font-semibold text-green-600">
                        R
                        {receipt.excessAmount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-600">Status</p>
                    <span
                      className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                        receipt.status === "sent"
                          ? "bg-green-100 text-green-800"
                          : receipt.status === "generated"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {receipt.status.charAt(0).toUpperCase() +
                        receipt.status.slice(1)}
                    </span>
                  </div>
                </div>

                {receipt.notes && (
                  <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-700">
                    <p className="text-xs text-gray-600 mb-1">Notes:</p>
                    <p>{receipt.notes}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleDownloadReceipt(receipt)}
                  className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 text-sm transition-colors"
                  title="Download receipt PDF"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>

                {receipt.status === "generated" && (
                  <button
                    onClick={() => handleMarkAsSent(receipt)}
                    disabled={updateStatusMutation.isPending}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm transition-colors disabled:bg-gray-400"
                    title="Mark as sent to customer"
                  >
                    {updateStatusMutation.isPending
                      ? "Marking..."
                      : "Mark Sent"}
                  </button>
                )}

                <button
                  onClick={() => handleDeleteReceipt(receipt._id)}
                  disabled={deleteReceiptMutation.isPending}
                  className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2 text-sm transition-colors disabled:bg-gray-400"
                  title="Delete receipt"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleteReceiptMutation.isPending ? "..." : "Del"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
