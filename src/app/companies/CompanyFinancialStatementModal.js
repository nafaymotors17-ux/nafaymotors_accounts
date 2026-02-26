"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getInvoices } from "@/app/lib/invoice-actions/invoices";
import { X } from "lucide-react";
import { formatDate } from "@/app/lib/utils/dateFormat";

// Flatten invoices into payment-only rows: one row per payment with invoice context
function buildPaymentRows(invoices) {
  const rows = [];
  for (const inv of invoices) {
    const invoiceTotal = inv.totalAmount || 0;
    const payments = inv.payments || [];
    for (const p of payments) {
      rows.push({
        key: `${inv._id}-${p._id}`,
        paymentDate: p.paymentDate,
        invoiceNumber: inv.invoiceNumber,
        dueOnInvoice: invoiceTotal,
        amountPaid: p.amount || 0,
        excessAmount: p.excessAmount || 0,
        paymentMethod: p.paymentMethod || "Cash",
        accountInfo: p.accountInfo,
        notes: p.notes,
      });
    }
  }
  // Newest first
  rows.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
  return rows;
}

export default function CompanyFinancialStatementModal({
  companyName,
  creditBalance = 0,
  totalDue = 0,
  onClose,
}) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data, isLoading, error } = useQuery({
    queryKey: ["company-financial-history", companyName, page, limit],
    queryFn: () =>
      getInvoices({
        page: page.toString(),
        limit: limit.toString(),
        company: companyName,
      }),
    enabled: !!companyName,
  });

  const invoices = data?.invoices || [];
  const pagination = data?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  };

  const paymentRows = useMemo(() => buildPaymentRows(invoices), [invoices]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-2xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="shrink-0 border-b bg-white p-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                Payment history
              </h2>
              <p className="text-lg font-medium text-blue-700 mt-1">
                {companyName}
              </p>
              <div className="flex gap-6 mt-2 text-sm">
                <span className="text-gray-600">
                  Credit balance:{" "}
                  <span className="font-semibold text-green-600">
                    R{(creditBalance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </span>
                <span className="text-gray-600">
                  Total due:{" "}
                  <span className="font-semibold text-blue-600">
                    R{(totalDue || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-gray-500 mb-3">
            When they paid, which invoice, how much was due on that invoice, and how much was paid.
          </p>

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              {error.message || "Failed to load payment history"}
            </div>
          ) : paymentRows.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {invoices.length === 0
                ? "No invoices found for this company."
                : "No payments recorded for this company."}
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Date paid
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Invoice #
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Due on invoice
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Amount paid
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Method
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paymentRows.map((row) => (
                      <tr key={row.key} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {formatDate(row.paymentDate)}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {row.invoiceNumber}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          R{row.dueOnInvoice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="font-medium text-green-600">
                            R{row.amountPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                          {row.excessAmount > 0 && (
                            <span className="block text-xs text-blue-600">
                              (excess R{row.excessAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} → credit)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-xs">
                          {row.paymentMethod}
                          {row.paymentMethod === "Bank" && row.accountInfo && (
                            <span className="block text-gray-400">{row.accountInfo}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-xs max-w-[180px] truncate" title={row.notes}>
                          {row.notes || "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pagination.totalPages > 1 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="text-gray-600">
                    Payments from invoices {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} invoices
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={!pagination.hasPrevPage}
                      className="px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <span className="px-2 text-gray-700">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!pagination.hasNextPage}
                      className="px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                      className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                    >
                      <option value={10}>10 invoices per page</option>
                      <option value={20}>20 invoices per page</option>
                      <option value={50}>50 invoices per page</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
