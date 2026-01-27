"use client";
import { useState } from "react";
import { Printer, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getTransactionsForPrint } from "@/lib/accounting-actions/transaction";
export default function PrintButton({ account, filters }) {
  const [loading, setLoading] = useState(false);

  const generatePDF = (data, totalCurrentBalance) => {
    const doc = new jsPDF();
    const margin = 14;

    // --- Header Section (Left Aligned) ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(31, 41, 55); // Dark Gray
    doc.text(`${account.title}`.toUpperCase(), margin, 20);
    const pageWidth = doc.internal.pageSize.getWidth();

    const lineHeight = 5;
    let yPosition = margin;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Account Statement: ${account.slug}`, margin, 26);
    const formattedBalance = (totalCurrentBalance ?? 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    doc.text(
      `Current Balance: ${account.currencySymbol}${formattedBalance}`,
      pageWidth - margin,
      yPosition,
      { align: "right" }
    );
    // Period and Search info
    doc.setFontSize(9);
    doc.text(`Period: ${filters.startDate} to ${filters.endDate}`, margin, 34);

    if (filters.search) {
      doc.text(`Filtered by: "${filters.search}"`, margin, 39);
    }

    // --- Data Processing ---
    let currentBalance = account.initialBalance || 0;
    let totalCredit = 0;
    let totalDebit = 0;

    const tableRows = data.map((t, index) => {
      const credit = t.credit || 0;
      const debit = t.debit || 0;
      totalCredit += credit;
      totalDebit += debit;
      currentBalance = currentBalance + credit - debit;

      return [
        index + 1,
        new Date(t.transactionDate).toLocaleDateString("en-GB"),
        t.details,
        credit > 0
          ? credit.toLocaleString(undefined, { minimumFractionDigits: 2 })
          : "-",
        debit > 0
          ? debit.toLocaleString(undefined, { minimumFractionDigits: 2 })
          : "-",
        currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }),
      ];
    });

    // Add a Summary Row at the end
    tableRows.push([
      {
        content: "TOTAL FOR PERIOD",
        colSpan: 3,
        styles: { halign: "right", fontStyle: "bold" },
      },
      {
        content: totalCredit.toLocaleString(undefined, {
          minimumFractionDigits: 2,
        }),
        styles: { fontStyle: "bold" },
      },
      {
        content: totalDebit.toLocaleString(undefined, {
          minimumFractionDigits: 2,
        }),
        styles: { fontStyle: "bold" },
      },
      {
        content: currentBalance.toLocaleString(undefined, {
          minimumFractionDigits: 2,
        }),
        styles: { fontStyle: "bold", fillColor: [240, 240, 240] },
      },
    ]);

    // --- Generate Table ---
    autoTable(doc, {
      startY: filters.search ? 45 : 40,
      head: [["S.No", "Date", "Description", "Credit", "Debit", "Balance"]],
      body: tableRows,
      theme: "grid",
      headStyles: {
        fillColor: [31, 41, 55],
        halign: "left", // Headers aligned left as requested
        fontSize: 9,
        cellPadding: 3,
      },
      styles: {
        fontSize: 8,
        valign: "middle",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 12 },
        1: { cellWidth: 25 },
        2: { cellWidth: "auto" },
        3: { halign: "right", cellWidth: 28 },
        4: { halign: "right", cellWidth: 28 },
        5: { halign: "right", cellWidth: 30 },
      },
      didParseCell: function (data) {
        // Optional: color the Debit text red and Credit green in the table
        if (data.section === "body") {
          if (data.column.index === 3 && data.cell.text[0] !== "-")
            data.cell.styles.textColor = [21, 128, 61]; // Green
          if (data.column.index === 4 && data.cell.text[0] !== "-")
            data.cell.styles.textColor = [185, 28, 28]; // Red
        }
      },
    });

    doc.save(`${account.slug}_statement.pdf`);
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/print-statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountSlug: account.slug, filters }),
      });

      if (!response.ok) throw new Error("Server error");
      const result = await response.json();

      if (result.transactions?.length > 0) {
        generatePDF(result.transactions, result.currentBalance);
      } else {
        alert("No records found for the selected range.");
      }
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="h-8 px-2 bg-slate-800 hover:bg-black text-white text-xs font-semibold rounded-md flex items-center gap-2 transition-all disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Printer className="w-3.5 h-3.5" />
      )}
      {loading ? "Preparing PDF..." : "Print Statement"}
    </button>
  );
}
