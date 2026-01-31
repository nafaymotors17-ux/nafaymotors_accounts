"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function CompanyBreakdown({ invoices, getPaymentInfo }) {
  const [expandedCompanies, setExpandedCompanies] = useState(new Set());

  const companyBreakdown = useMemo(() => {
    const breakdown = {};

    invoices.forEach((invoice) => {
      const companyName = invoice.clientCompanyName || "Unknown";
      if (!breakdown[companyName]) {
        breakdown[companyName] = {
          totalInvoices: 0,
          paidCount: 0,
          unpaidCount: 0,
          partialCount: 0,
          totalAmount: 0,
          totalPaid: 0,
          outstandingBalance: 0,
        };
      }

      const paymentInfo = getPaymentInfo(invoice);
      breakdown[companyName].totalInvoices++;
      breakdown[companyName].totalAmount += invoice.totalAmount || 0;
      breakdown[companyName].totalPaid += paymentInfo.totalPaid;
      breakdown[companyName].outstandingBalance += paymentInfo.remainingBalance;

      if (paymentInfo.paymentStatus === "paid") breakdown[companyName].paidCount++;
      else if (paymentInfo.paymentStatus === "unpaid") breakdown[companyName].unpaidCount++;
      else if (paymentInfo.paymentStatus === "partial") breakdown[companyName].partialCount++;
    });

    return Object.entries(breakdown)
      .map(([companyName, stats]) => ({ companyName, ...stats }))
      .sort((a, b) => b.outstandingBalance - a.outstandingBalance);
  }, [invoices, getPaymentInfo]);

  const toggleCompany = (companyName) => {
    setExpandedCompanies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(companyName)) {
        newSet.delete(companyName);
      } else {
        newSet.add(companyName);
      }
      return newSet;
    });
  };

  if (companyBreakdown.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold text-gray-800">Company Breakdown</h3>
        <p className="text-xs text-gray-500 mt-1">Payment status by company</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Invoices</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Amount</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {companyBreakdown.map((company) => {
              const isExpanded = expandedCompanies.has(company.companyName);
              return (
                <tr key={company.companyName} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleCompany(company.companyName)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {company.companyName}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">
                    {company.totalInvoices}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                    R{company.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-blue-600">
                    R{company.totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold">
                    <span
                      className={
                        company.outstandingBalance > 0 ? "text-red-600" : "text-green-600"
                      }
                    >
                      R{company.outstandingBalance.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    <div className="flex gap-1 justify-center flex-wrap">
                      {company.paidCount > 0 && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                          Paid: {company.paidCount}
                        </span>
                      )}
                      {company.partialCount > 0 && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                          Partial: {company.partialCount}
                        </span>
                      )}
                      {company.unpaidCount > 0 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">
                          Unpaid: {company.unpaidCount}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
