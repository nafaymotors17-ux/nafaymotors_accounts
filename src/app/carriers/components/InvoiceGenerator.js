"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Download, Plus, Trash2, FileSpreadsheet, Building2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { getAllCompanies } from "@/app/lib/carriers-actions/companies";
import { formatDate } from "@/app/lib/utils/dateFormat";

export default function InvoiceGenerator({ carrier, cars, companies = [], onClose }) {
  const router = useRouter();
  const [includeAllCars, setIncludeAllCars] = useState(true);
  const [filteredCars, setFilteredCars] = useState(cars);
  const [descriptions, setDescriptions] = useState([]);
  const [senderCompany, setSenderCompany] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    company: "",
  });

  // Get unique client companies from cars
  const clientCompanies = useMemo(() => {
    const unique = new Set();
    (filteredCars || []).forEach((car) => {
      if (car.companyName) unique.add(car.companyName);
    });
    return Array.from(unique);
  }, [filteredCars]);

  // Get sender companies (companies that can send invoices)
  const [senderCompanies, setSenderCompanies] = useState([]);
  
  useEffect(() => {
    getAllCompanies().then((result) => {
      setSenderCompanies(result.companies || []);
    });
  }, []);

  const totals = useMemo(() => {
    const safeCars = filteredCars || [];
    const totalAmount = safeCars.reduce((sum, car) => sum + (car?.amount || 0), 0);
    return { totalAmount };
  }, [filteredCars]);

  const addDescription = () => {
    setDescriptions([...descriptions, ""]);
  };

  const removeDescription = (index) => {
    setDescriptions(descriptions.filter((_, i) => i !== index));
  };

  const updateDescription = (index, value) => {
    const updated = [...descriptions];
    updated[index] = value;
    setDescriptions(updated);
  };

  const applyFilters = () => {
    let filtered = [...cars];

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(
        (car) => new Date(car.date) >= startDate
      );
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        (car) => new Date(car.date) <= endDate
      );
    }

    if (filters.company) {
      filtered = filtered.filter(
        (car) =>
          car.companyName?.toLowerCase().includes(filters.company.toLowerCase())
      );
    }

    setFilteredCars(filtered);
  };

  const generatePDF = () => {
    if (!carrier || !carrier.tripNumber) {
      alert("Invalid carrier data");
      return;
    }

    if (!senderCompany) {
      alert("Please select a sender company");
      return;
    }

    if (!clientName) {
      alert("Please enter client name");
      return;
    }

    try {
      const doc = new jsPDF();
      const margin = 14;
      const pageWidth = doc.internal.pageSize.getWidth();
      let currentY = 20;

      // Get sender company details
      const sender = senderCompanies.find(c => c._id === senderCompany || c.name === senderCompany);
      const senderName = sender?.companyName || sender?.name || senderCompany;
      const senderAddress = sender?.address || "";

      // Header - Sender Company
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(31, 41, 55);
      doc.text(senderName || "COMPANY NAME", margin, currentY);
      currentY += 6;

      if (senderAddress) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(senderAddress, margin, currentY);
        currentY += 6;
      }

      // TAX INVOICE Title
      currentY += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(31, 41, 55);
      doc.text("TAX INVOICE", pageWidth / 2, currentY, { align: "center" });
      currentY += 6;

      // Client Name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(clientName.toUpperCase(), pageWidth / 2, currentY, { align: "center" });
      currentY += 8;

      // Invoice Number and Date (right aligned)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100);
      const invoiceNoText = `INVOICE NO: ${invoiceNumber || "N/A"}`;
      const invoiceDateText = `DATE: ${formatDate(new Date()).toUpperCase()}`;
      doc.text(invoiceNoText, pageWidth - margin, currentY, { align: "right" });
      currentY += 5;
      doc.text(invoiceDateText, pageWidth - margin, currentY, { align: "right" });
      currentY += 10;

      // Table data - SR, DATE, STOCK, CLIENT NAME, VEHICLE, CHASSIS, AMOUNT
      const tableRows = (filteredCars || []).map((car, index) => [
        index + 1,
        formatDate(car.date),
        car.stockNo || "",
        car.companyName || clientName || "",
        car.name || "",
        car.chassis || "",
        (car.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 }),
      ]);

      // Add TOTAL row
      tableRows.push([
        {
          content: "TOTAL",
          colSpan: 6,
          styles: { halign: "right", fontStyle: "bold" },
        },
        {
          content: totals.totalAmount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
          }),
          styles: { fontStyle: "bold" },
        },
      ]);

      // Generate table
      autoTable(doc, {
        startY: currentY,
        head: [
          [
            "SR",
            "DATE",
            "STOCK",
            "CLIENT NAME",
            "VEHICLE",
            "CHASSIS",
            "AMOUNT",
          ],
        ],
        body: tableRows,
        theme: "grid",
        headStyles: {
          fillColor: [31, 41, 55],
          halign: "left",
          fontSize: 9,
          cellPadding: 3,
        },
        styles: {
          fontSize: 8,
          valign: "middle",
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          3: { cellWidth: 30 },
          4: { cellWidth: 25 },
          5: { cellWidth: 35 },
          6: { halign: "right", cellWidth: 25 },
        },
      });

      // VAT and Total section
      let finalY = doc.lastAutoTable.finalY + 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("VAT: ZERO", margin, finalY);
      doc.text(`R0`, pageWidth - margin, finalY, { align: "right" });
      finalY += 6;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("TOTAL:", margin, finalY);
      doc.text(
        `R${totals.totalAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })}`,
        pageWidth - margin,
        finalY,
        { align: "right" }
      );
      finalY += 10;

      // Thank you message
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text("* THANK YOU FOR DOING BUSINESS WITH US...!!", pageWidth / 2, finalY, { align: "center" });
      finalY += 8;

      // Descriptions section
      if (descriptions.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(31, 41, 55);
        doc.text("DESCRIPTIONS:", margin, finalY);
        finalY += 6;
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        descriptions.forEach((desc) => {
          if (desc.trim()) {
            doc.text(`• ${desc}`, margin + 5, finalY);
            finalY += 5;
          }
        });
      }

      const fileName = `Invoice_${invoiceNumber || carrier.tripNumber}_${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please check the data and try again.");
    }
  };

  const generateExcel = () => {
    if (!carrier || !carrier.tripNumber) {
      alert("Invalid carrier data");
      return;
    }

    if (!senderCompany) {
      alert("Please select a sender company");
      return;
    }

    if (!clientName) {
      alert("Please enter client name");
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      const sender = senderCompanies.find(c => c._id === senderCompany || c.name === senderCompany);
      const senderName = sender?.companyName || sender?.name || senderCompany;
      const senderAddress = sender?.address || "";

      const invoiceData = [
        [senderName || "COMPANY NAME"],
        senderAddress ? [senderAddress] : [],
        [],
        ["TAX INVOICE"],
        [],
        [clientName.toUpperCase()],
        [],
        [`INVOICE NO: ${invoiceNumber || "N/A"}`, `DATE: ${formatDate(new Date()).toUpperCase()}`],
        [],
        ["SR", "DATE", "STOCK", "CLIENT NAME", "VEHICLE", "CHASSIS", "AMOUNT"],
      ];

      // Add car rows
      (filteredCars || []).forEach((car, index) => {
        invoiceData.push([
          index + 1,
          formatDate(car.date),
          car.stockNo || "",
          car.companyName || clientName || "",
          car.name || "",
          car.chassis || "",
          car.amount || 0,
        ]);
      });

      // Add totals
      invoiceData.push([]);
      invoiceData.push(["TOTAL", "", "", "", "", "", totals.totalAmount || 0]);
      invoiceData.push([]);
      invoiceData.push(["VAT: ZERO", "", "", "", "", "", "R0"]);
      invoiceData.push(["TOTAL", "", "", "", "", "", `R${totals.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`]);
      invoiceData.push([]);
      invoiceData.push(["* THANK YOU FOR DOING BUSINESS WITH US...!!"]);

      // Add descriptions
      if (descriptions.length > 0) {
        invoiceData.push([]);
        invoiceData.push(["DESCRIPTIONS:"]);
        descriptions.forEach((desc) => {
          if (desc.trim()) {
            invoiceData.push([`• ${desc}`]);
          }
        });
      }

      const ws = XLSX.utils.aoa_to_sheet(invoiceData);
      ws["!cols"] = [
        { wch: 5 },  // SR
        { wch: 12 }, // DATE
        { wch: 12 }, // STOCK
        { wch: 20 }, // CLIENT NAME
        { wch: 15 }, // VEHICLE
        { wch: 20 }, // CHASSIS
        { wch: 15 }, // AMOUNT
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Invoice");
      const fileName = `Invoice_${invoiceNumber || carrier.tripNumber}_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error("Error generating Excel:", error);
      alert("Failed to generate Excel file. Please check the data and try again.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-6xl rounded-lg shadow-2xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Generate TAX INVOICE</h2>
              <p className="text-sm text-gray-600 mt-1">
                Trip: {carrier.tripNumber} | Date: {formatDate(carrier.date)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Invoice Details */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Invoice Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Building2 className="w-4 h-4 inline mr-2" />
                  Sender Company (Who is sending invoice)
                </label>
                <select
                  value={senderCompany}
                  onChange={(e) => setSenderCompany(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">-- Select Sender Company --</option>
                  {senderCompanies.map((company) => (
                    <option key={company._id} value={company._id}>
                      {company.companyName || company.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Name (Who is receiving invoice)
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value.toUpperCase())}
                  placeholder="Enter client name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value.toUpperCase())}
                  placeholder="e.g., D0005"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
          </div>

          {/* Filter Options */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeAllCars}
                  onChange={(e) => {
                    setIncludeAllCars(e.target.checked);
                    if (e.target.checked) {
                      setFilteredCars(cars);
                    }
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Include All Cars</span>
              </label>
            </div>

            {!includeAllCars && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) =>
                      setFilters({ ...filters, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) =>
                      setFilters({ ...filters, endDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={filters.company}
                    onChange={(e) =>
                      setFilters({ ...filters, company: e.target.value })
                    }
                    placeholder="Filter by company"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
            )}

            {!includeAllCars && (
              <button
                onClick={applyFilters}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Apply Filters
              </button>
            )}
          </div>

          {/* Descriptions */}
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Descriptions (Additional information)
              </label>
              <button
                type="button"
                onClick={addDescription}
                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Description
              </button>
            </div>
            {descriptions.length > 0 && (
              <div className="space-y-2">
                {descriptions.map((desc, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Enter description (e.g., CARRIER TRANSPORT CHARGES FROM BEITBRIDGE BORDER POST TO ZIMBABWE)"
                      value={desc}
                      onChange={(e) => updateDescription(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-purple-300 rounded-md text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeDescription(index)}
                      className="px-2 py-2 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 p-4 border-b">
              <h3 className="font-semibold text-gray-800">
                Invoice Preview ({filteredCars.length} cars)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      SR
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      DATE
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      STOCK
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      CLIENT NAME
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      VEHICLE
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      CHASSIS
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      AMOUNT
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCars.map((car, index) => (
                    <tr key={car._id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600">{index + 1}</td>
                      <td className="px-3 py-2">{formatDate(car.date)}</td>
                      <td className="px-3 py-2 font-medium">{car.stockNo}</td>
                      <td className="px-3 py-2">{car.companyName || clientName || ""}</td>
                      <td className="px-3 py-2">{car.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{car.chassis}</td>
                      <td className="px-3 py-2 text-green-600 font-semibold">
                        R {(car.amount || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="6" className="px-3 py-3 text-right font-semibold">
                      TOTAL:
                    </td>
                    <td className="px-3 py-3 text-green-600 font-bold">
                      R {totals.totalAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={generateExcel}
              disabled={!senderCompany || !clientName}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Download Excel
            </button>
            <button
              onClick={generatePDF}
              disabled={!senderCompany || !clientName}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
