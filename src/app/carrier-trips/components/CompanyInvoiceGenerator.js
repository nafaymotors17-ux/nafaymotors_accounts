"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { X, Download, Plus, Trash2, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { getCarsByCompany } from "@/app/lib/carriers-actions/cars";
import { formatDate } from "@/app/lib/utils/dateFormat";

export default function CompanyInvoiceGenerator({ companies, initialCompany = null, onClose }) {
  const params = useSearchParams();
  
  // Get filters from URL params (set in main page)
  const companyFilter = params.get("company") || "";
  const startDateFilter = params.get("startDate") || "";
  const endDateFilter = params.get("endDate") || "";
  const isActiveFilter = params.get("isActive") || "";
  
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [descriptions, setDescriptions] = useState([]);
  
  // Sender company details - user enters manually (user is the handling company)
  const [senderCompanyName, setSenderCompanyName] = useState("");
  const [senderCompanyAddress, setSenderCompanyAddress] = useState("");
  
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [vatPercentage, setVatPercentage] = useState(""); // VAT percentage (e.g., 15 for 15%)

  // Find the selected company from companies list
  const selectedCompany = useMemo(() => {
    if (companyFilter) {
      return companies.find(c => c.name === companyFilter) || null;
    }
    return initialCompany;
  }, [companyFilter, companies, initialCompany]);

  const clientName = selectedCompany?.name || companyFilter || "";

  const totals = useMemo(() => {
    const totalAmount = cars.reduce((sum, car) => sum + (car?.amount || 0), 0);
    const vatPercent = parseFloat(vatPercentage) || 0;
    const vatAmount = vatPercent > 0 ? (totalAmount * vatPercent) / 100 : 0;
    const totalWithVat = totalAmount + vatAmount;
    return { 
      totalAmount, 
      vatPercentage: vatPercent,
      vatAmount,
      totalWithVat 
    };
  }, [cars, vatPercentage]);

  // Fetch cars only when company and date filters are applied
  useEffect(() => {
    const fetchCars = async () => {
      // Only fetch if we have company and date filters
      if (!companyFilter || !startDateFilter || !endDateFilter) {
        setCars([]);
        return;
      }

      if (!selectedCompany) {
        setCars([]);
        return;
      }

      setLoading(true);
      try {
        const result = await getCarsByCompany({
          companyName: selectedCompany.name,
          startDate: startDateFilter,
          endDate: endDateFilter,
          isActive: isActiveFilter, // Pass the active/inactive filter
        });

        if (result.success) {
          const fetchedCars = result.cars || [];
          setCars(fetchedCars);
          // Note: User is the handling company, so they enter their details manually
        } else {
          alert(result.error || "Failed to fetch cars");
          setCars([]);
        }
      } catch (error) {
        console.error("Error fetching cars:", error);
        alert("Failed to fetch cars");
        setCars([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCars();
  }, [companyFilter, startDateFilter, endDateFilter, isActiveFilter, selectedCompany]);

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

  const generatePDF = () => {
    if (!selectedCompany || cars.length === 0) {
      alert("Please ensure company and date filters are applied and there are cars to invoice");
      return;
    }

    if (!senderCompanyName.trim()) {
      alert("Please enter sender company name");
      return;
    }

    try {
      const doc = new jsPDF();
      const margin = 14;
      const pageWidth = doc.internal.pageSize.getWidth();
      let currentY = 20;

      // Header - Sender Company
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(31, 41, 55);
      doc.text(senderCompanyName.toUpperCase() || "COMPANY NAME", margin, currentY);
      currentY += 6;

      if (senderCompanyAddress) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(senderCompanyAddress, margin, currentY);
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
      const tableRows = cars.map((car, index) => [
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
      
      if (totals.vatPercentage > 0) {
        doc.text(`VAT (${totals.vatPercentage}%):`, margin, finalY);
        doc.text(
          `R${totals.vatAmount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
          })}`,
          pageWidth - margin,
          finalY,
          { align: "right" }
        );
        finalY += 6;
      } else {
        doc.text("VAT: ZERO", margin, finalY);
        doc.text(`R0`, pageWidth - margin, finalY, { align: "right" });
        finalY += 6;
      }
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("TOTAL:", margin, finalY);
      doc.text(
        `R${totals.totalWithVat.toLocaleString("en-US", {
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

      const fileName = `Invoice_${invoiceNumber || clientName}_${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please check the data and try again.");
    }
  };

  const generateExcel = () => {
    if (!selectedCompany || cars.length === 0) {
      alert("Please ensure company and date filters are applied and there are cars to invoice");
      return;
    }

    if (!senderCompanyName.trim()) {
      alert("Please enter sender company name");
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      const invoiceData = [
        [senderCompanyName.toUpperCase() || "COMPANY NAME"],
        senderCompanyAddress ? [senderCompanyAddress] : [],
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
      cars.forEach((car, index) => {
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
      
      if (totals.vatPercentage > 0) {
        invoiceData.push([`VAT (${totals.vatPercentage}%):`, "", "", "", "", "", `R${totals.vatAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`]);
      } else {
        invoiceData.push(["VAT: ZERO", "", "", "", "", "", "R0"]);
      }
      
      invoiceData.push(["TOTAL", "", "", "", "", "", `R${totals.totalWithVat.toLocaleString("en-US", { minimumFractionDigits: 2 })}`]);
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
      const fileName = `Invoice_${invoiceNumber || clientName}_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error("Error generating Excel:", error);
      alert("Failed to generate Excel file. Please check the data and try again.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-lg shadow-2xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-2 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Generate TAX INVOICE</h2>
              <p className="text-xs text-gray-600 mt-0.5">
                {!companyFilter || !startDateFilter || !endDateFilter 
                  ? "Please apply company and date filters in the main page first"
                  : `Client: ${clientName} | Period: ${startDateFilter} to ${endDateFilter}${isActiveFilter ? ` | Status: ${isActiveFilter === 'true' ? 'Active' : 'Inactive'}` : ''}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-3 space-y-3">
          {/* Invoice Details */}
          <div className="bg-gray-50 p-2 rounded-lg space-y-2">
            <h3 className="text-xs font-medium text-gray-700">Invoice Details</h3>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value.toUpperCase())}
                  placeholder="e.g., D0005"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                  Sender Company <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={senderCompanyName}
                  onChange={(e) => setSenderCompanyName(e.target.value)}
                  placeholder="Company name"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                  VAT Percentage (Optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={vatPercentage}
                  onChange={(e) => setVatPercentage(e.target.value)}
                  placeholder="e.g., 15 for 15%"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                />
                <p className="text-[9px] text-gray-500 mt-0.5">Leave empty for zero VAT</p>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                Sender Address
              </label>
              <textarea
                value={senderCompanyAddress}
                onChange={(e) => setSenderCompanyAddress(e.target.value)}
                placeholder="Company address"
                rows={2}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              />
            </div>
          </div>

          {/* Descriptions */}
          <div className="bg-purple-50 p-2 rounded-lg">
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-medium text-gray-700">
                Descriptions
              </label>
              <button
                type="button"
                onClick={addDescription}
                className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
            {descriptions.length > 0 && (
              <div className="space-y-1.5">
                {descriptions.map((desc, index) => (
                  <div key={index} className="flex gap-1.5 items-center">
                    <input
                      type="text"
                      placeholder="Enter description"
                      value={desc}
                      onChange={(e) => updateDescription(index, e.target.value)}
                      className="flex-1 px-2 py-1 border border-purple-300 rounded text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeDescription(index)}
                      className="px-1.5 py-1 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          {loading ? (
            <div className="text-center py-4 text-gray-500 text-xs">Loading cars...</div>
          ) : !companyFilter || !startDateFilter || !endDateFilter ? (
            <div className="text-center py-4 text-gray-500 border rounded-lg bg-yellow-50 text-xs">
              <p className="font-medium mb-1">Filters Required</p>
              <p>Please apply company and date filters in the main page before generating invoice.</p>
            </div>
          ) : cars.length === 0 ? (
            <div className="text-center py-4 text-gray-500 border rounded-lg text-xs">
              No cars found for the selected filters
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 p-1.5 border-b">
                <h3 className="font-semibold text-gray-800 text-xs">
                  Invoice Preview ({cars.length} cars)
                </h3>
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-500 uppercase">
                        SR
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-500 uppercase">
                        DATE
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-500 uppercase">
                        STOCK
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-500 uppercase">
                        CLIENT
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-500 uppercase">
                        VEHICLE
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-500 uppercase">
                        CHASSIS
                      </th>
                      <th className="px-1.5 py-1 text-right text-[10px] font-medium text-gray-500 uppercase">
                        AMOUNT
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {cars.map((car, index) => (
                      <tr key={car._id} className="hover:bg-gray-50">
                        <td className="px-1.5 py-1 text-gray-600">{index + 1}</td>
                        <td className="px-1.5 py-1 whitespace-nowrap">{formatDate(car.date)}</td>
                        <td className="px-1.5 py-1 font-medium">{car.stockNo}</td>
                        <td className="px-1.5 py-1">{car.companyName || clientName || ""}</td>
                        <td className="px-1.5 py-1">{car.name}</td>
                        <td className="px-1.5 py-1 font-mono text-[10px]">{car.chassis}</td>
                        <td className="px-1.5 py-1 text-green-600 font-semibold text-right whitespace-nowrap">
                          R {(car.amount || 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 sticky bottom-0">
                    <tr>
                      <td colSpan="6" className="px-1.5 py-1.5 text-right font-semibold text-xs">
                        SUBTOTAL:
                      </td>
                      <td className="px-1.5 py-1.5 text-green-600 font-semibold text-right text-xs">
                        R {totals.totalAmount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                    {totals.vatPercentage > 0 && (
                      <tr>
                        <td colSpan="6" className="px-1.5 py-1.5 text-right font-semibold text-xs">
                          VAT ({totals.vatPercentage}%):
                        </td>
                        <td className="px-1.5 py-1.5 text-green-600 font-semibold text-right text-xs">
                          R {totals.vatAmount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan="6" className="px-1.5 py-1.5 text-right font-bold text-xs">
                        TOTAL:
                      </td>
                      <td className="px-1.5 py-1.5 text-green-600 font-bold text-right text-xs">
                        R {totals.totalWithVat.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={generateExcel}
              disabled={!selectedCompany || !senderCompanyName.trim() || cars.length === 0 || loading}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <FileSpreadsheet className="w-3 h-3" />
              Excel
            </button>
            <button
              onClick={generatePDF}
              disabled={!selectedCompany || !senderCompanyName.trim() || cars.length === 0 || loading}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
