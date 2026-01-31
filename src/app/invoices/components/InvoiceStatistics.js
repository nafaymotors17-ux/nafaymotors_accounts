"use client";

import { useMemo } from "react";

export default function InvoiceStatistics({ invoices, getPaymentInfo }) {
  const statistics = useMemo(() => {
    let totalInvoices = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let partialCount = 0;
    let totalAmount = 0;
    let totalPaid = 0;
    let outstandingBalance = 0;

    invoices.forEach((invoice) => {
      totalInvoices++;
      const paymentInfo = getPaymentInfo(invoice);
      totalAmount += invoice.totalAmount || 0;
      totalPaid += paymentInfo.totalPaid;
      outstandingBalance += paymentInfo.remainingBalance;

      if (paymentInfo.paymentStatus === "paid") paidCount++;
      else if (paymentInfo.paymentStatus === "unpaid") unpaidCount++;
      else if (paymentInfo.paymentStatus === "partial") partialCount++;
    });

    return {
      totalInvoices,
      paidCount,
      unpaidCount,
      partialCount,
      totalAmount,
      totalPaid,
      outstandingBalance,
    };
  }, [invoices, getPaymentInfo]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <p className="text-xs text-gray-500 mb-1">Total Invoices</p>
        <p className="text-2xl font-bold text-gray-800">{statistics.totalInvoices}</p>
        <div className="mt-2 flex gap-2 text-xs flex-wrap">
          <span className="text-green-600">Paid: {statistics.paidCount}</span>
          <span className="text-yellow-600">Partial: {statistics.partialCount}</span>
          <span className="text-red-600">Unpaid: {statistics.unpaidCount}</span>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <p className="text-xs text-gray-500 mb-1">Total Amount</p>
        <p className="text-2xl font-bold text-green-600">
          R{statistics.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Paid: R{statistics.totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <p className="text-xs text-gray-500 mb-1">Outstanding Balance</p>
        <p className="text-2xl font-bold text-red-600">
          R{statistics.outstandingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {statistics.unpaidCount + statistics.partialCount} invoices
        </p>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <p className="text-xs text-gray-500 mb-1">Payment Rate</p>
        <p className="text-2xl font-bold text-blue-600">
          {statistics.totalAmount > 0
            ? ((statistics.totalPaid / statistics.totalAmount) * 100).toFixed(1)
            : 0}%
        </p>
        <p className="text-xs text-gray-500 mt-1">Collection rate</p>
      </div>
    </div>
  );
}
