"use client";
import { Printer } from "lucide-react";
import { useState } from "react";

export default function PrintButton({
  filters,
  account,
  stats,
  allTransactions,
}) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    try {
      setIsPrinting(true);

      // Open print window
      const printWindow = window.open("", "_blank", "width=800,height=600");

      if (!printWindow) {
        alert("Please allow popups to print");
        setIsPrinting(false);
        return;
      }

      // Format date for display
      const formatDate = (date) => {
        return new Date(date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      };

      // Format currency
      const money = (amount) =>
        Number(amount ?? 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

      // Create print content
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${account.title} - Account Statement</title>
          <style>
            @media print {
              @page {
                margin: 0.5in;
                size: landscape;
              }
              body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 12px;
                color: #333;
                margin: 0;
                padding: 20px;
              }
              .print-header {
                text-align: center;
                border-bottom: 2px solid #333;
                padding-bottom: 15px;
                margin-bottom: 20px;
              }
              .print-header h1 {
                margin: 0;
                font-size: 24px;
                color: #1f2937;
              }
              .print-header .subtitle {
                color: #6b7280;
                font-size: 14px;
                margin-top: 5px;
              }
              .info-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 15px;
                margin-bottom: 25px;
                padding: 15px;
                background: #f9fafb;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
              }
              .info-item {
                text-align: center;
              }
              .info-label {
                font-size: 10px;
                text-transform: uppercase;
                color: #6b7280;
                font-weight: 600;
                margin-bottom: 4px;
              }
              .info-value {
                font-size: 14px;
                font-weight: 600;
                color: #1f2937;
                font-family: 'Courier New', monospace;
              }
              .balance-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 15px;
                margin-bottom: 25px;
                padding: 15px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
              }
              .balance-item {
                padding: 10px;
                border-radius: 6px;
                text-align: center;
              }
              .balance-label {
                font-size: 10px;
                text-transform: uppercase;
                font-weight: 600;
                margin-bottom: 5px;
                letter-spacing: 0.05em;
              }
              .balance-value {
                font-size: 16px;
                font-weight: 700;
                font-family: 'Courier New', monospace;
              }
              .opening {
                background: #f0f9ff;
                border: 1px solid #bae6fd;
              }
              .credit {
                background: #f0fdf4;
                border: 1px solid #bbf7d0;
              }
              .debit {
                background: #fef2f2;
                border: 1px solid #fecaca;
              }
              .closing {
                background: #fefce8;
                border: 1px solid #fde047;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
              }
              th {
                background-color: #f3f4f6;
                color: #374151;
                font-weight: 600;
                text-transform: uppercase;
                font-size: 11px;
                padding: 10px 12px;
                text-align: left;
                border-bottom: 2px solid #d1d5db;
              }
              td {
                padding: 10px 12px;
                border-bottom: 1px solid #e5e7eb;
                font-size: 12px;
              }
              tr:hover {
                background-color: #f9fafb;
              }
              .text-right {
                text-align: right;
              }
              .text-center {
                text-align: center;
              }
              .credit-amount {
                color: #059669;
                font-weight: 600;
                font-family: 'Courier New', monospace;
              }
              .debit-amount {
                color: #dc2626;
                font-weight: 600;
                font-family: 'Courier New', monospace;
              }
              .balance-amount {
                color: #1f2937;
                font-weight: 700;
                font-family: 'Courier New', monospace;
              }
              .date-cell {
                font-family: 'Courier New', monospace;
                white-space: nowrap;
                color: #6b7280;
              }
              .footer {
                margin-top: 30px;
                padding-top: 15px;
                border-top: 1px solid #d1d5db;
                font-size: 11px;
                color: #6b7280;
                text-align: center;
              }
              .footer-info {
                display: flex;
                justify-content: space-between;
                margin-top: 10px;
              }
              .no-print {
                display: none;
              }
              .print-only {
                display: block;
              }
            }
            @media screen {
              .print-only {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>${account.title} Account Statement</h1>
            <div class="subtitle">
              Account: ${account.slug} | 
              Date Range: ${formatDate(filters.startDate)} to ${formatDate(
        filters.endDate
      )} | 
              Printed: ${new Date().toLocaleDateString()}
            </div>
          </div>
          
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Account</div>
              <div class="info-value">${account.title}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Account Code</div>
              <div class="info-value">${account.slug}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Currency</div>
              <div class="info-value">${account.currency}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Printed On</div>
              <div class="info-value">${new Date().toLocaleString()}</div>
            </div>
          </div>
          
          <div class="balance-grid">
            <div class="balance-item opening">
              <div class="balance-label">Opening Balance</div>
              <div class="balance-value">${account.currencySymbol}${money(
        stats.openingBalance
      )}</div>
            </div>
            <div class="balance-item credit">
              <div class="balance-label">Total Credit</div>
              <div class="balance-value">${account.currencySymbol}${money(
        stats.totalCredit
      )}</div>
            </div>
            <div class="balance-item debit">
              <div class="balance-label">Total Debit</div>
              <div class="balance-value">${account.currencySymbol}${money(
        stats.totalDebit
      )}</div>
            </div>
            <div class="balance-item closing">
              <div class="balance-label">Closing Balance</div>
              <div class="balance-value">${account.currencySymbol}${money(
        stats.closingBalance
      )}</div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Description</th>
                <th class="text-right">Credit (${account.currency})</th>
                <th class="text-right">Debit (${account.currency})</th>
                <th class="text-right">Balance (${account.currency})</th>
              </tr>
            </thead>
            <tbody>
              ${stats.transactionsWithBalance
                .map(
                  (t) => `
                <tr>
                  <td class="date-cell">
                    ${new Date(t.transactionDate).toLocaleString("en-US", {
                      month: "2-digit",
                      day: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </td>
                  <td>
                    ${t.details}
                    ${
                      t.destination
                        ? `<br><small style="color: #6b7280; font-size: 10px;">→ ${t.destination}</small>`
                        : ""
                    }
                    ${
                      t.rateOfExchange
                        ? `<br><small style="color: #f97316; font-size: 10px;">@ ${t.rateOfExchange}</small>`
                        : ""
                    }
                  </td>
                  <td class="text-right credit-amount">
                    ${
                      (t.credit ?? 0) > 0
                        ? `${account.currencySymbol}${money(t.credit)}`
                        : ""
                    }
                  </td>
                  <td class="text-right debit-amount">
                    ${
                      (t.debit ?? 0) > 0
                        ? `${account.currencySymbol}${money(t.debit)}`
                        : ""
                    }
                  </td>
                  <td class="text-right balance-amount">
                    ${account.currencySymbol}${money(t.runningBalance)}
                  </td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          
          <div class="footer">
            <div>Total Transactions: ${
              stats.transactionsWithBalance.length
            }</div>
            <div class="footer-info">
              <div>Filters Applied: 
                ${filters.search ? `Search: "${filters.search}"` : ""}
                ${
                  filters.type && filters.type !== "all"
                    ? ` | Type: ${filters.type}`
                    : ""
                }
              </div>
              <div>Page 1 of 1</div>
            </div>
            <div style="margin-top: 20px; font-size: 10px; color: #9ca3af;">
              Generated by Accounting System
            </div>
          </div>
          
          <script>
            // Auto-print and close
            window.onload = function() {
              setTimeout(() => {
                window.print();
                setTimeout(() => {
                  window.close();
                }, 500);
              }, 500);
            };
          </script>
        </body>
        </html>
      `;

      // Write content to print window
      printWindow.document.write(printContent);
      printWindow.document.close();
    } catch (error) {
      console.error("Print error:", error);
      alert("Error generating print. Please try again.");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <button
      onClick={handlePrint}
      disabled={isPrinting}
      className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md border border-blue-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      title="Print Statement"
    >
      <Printer className="w-4 h-4" />
      <span className="hidden md:inline text-sm font-medium">
        {isPrinting ? "Printing..." : "Print"}
      </span>
    </button>
  );
}
