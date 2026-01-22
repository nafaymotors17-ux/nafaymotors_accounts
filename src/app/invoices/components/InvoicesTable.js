"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Download, Eye, X, Trash2 } from "lucide-react";
import { formatDate } from "@/app/lib/utils/dateFormat";
import { getInvoiceById, deleteInvoice } from "@/app/lib/invoice-actions/invoices";
import { getCarsByCompany } from "@/app/lib/carriers-actions/cars";
import { useUser } from "@/app/components/UserContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export default function InvoicesTable({ invoices, pagination, companies = [] }) {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useUser();
  const isSuperAdmin = user?.role === "super_admin";
  const [searchQuery, setSearchQuery] = useState(params.get("search") || "");
  const [selectedCompany, setSelectedCompany] = useState(params.get("company") || "");
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [invoiceCars, setInvoiceCars] = useState([]);
  const [loadingCars, setLoadingCars] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState(null);
  const searchTimeoutRef = useRef(null);

  // Auto-search with debouncing for invoice number search
  useEffect(() => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for auto-search
    searchTimeoutRef.current = setTimeout(() => {
      const newParams = new URLSearchParams();
      if (searchQuery.trim()) {
        newParams.set("search", searchQuery.trim());
      }
      if (selectedCompany) {
        newParams.set("company", selectedCompany);
      }
      // Reset to page 1 when searching
      newParams.set("page", "1");
      router.push(`/invoices?${newParams.toString()}`);
    }, 500); // 500ms debounce

    // Cleanup
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, selectedCompany, router]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCompany("");
    router.push("/invoices");
  };

  const handleDeleteInvoice = async (invoiceId, invoiceNumber) => {
    if (!isSuperAdmin) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete invoice ${invoiceNumber}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingInvoiceId(invoiceId);
    try {
      const result = await deleteInvoice(invoiceId);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error || "Failed to delete invoice");
      }
    } catch (error) {
      alert("An error occurred while deleting the invoice");
    } finally {
      setDeletingInvoiceId(null);
    }
  };

  const handleViewInvoice = async (invoice) => {
    setViewingInvoice(invoice);
    setLoadingCars(true);
    try {
      // Fetch cars for this invoice
      const result = await getCarsByCompany({
        companyName: invoice.clientCompanyName,
        startDate: invoice.startDate,
        endDate: invoice.endDate,
        isActive: invoice.isActive,
      });
      if (result.success) {
        // Filter to only include cars that are in the invoice
        const invoiceCarIds = invoice.carIds.map(id => id.toString());
        const filteredCars = (result.cars || []).filter(car => 
          invoiceCarIds.includes(car._id.toString())
        );
        setInvoiceCars(filteredCars);
      }
    } catch (error) {
      console.error("Error fetching invoice cars:", error);
    } finally {
      setLoadingCars(false);
    }
  };

  const generatePDFFromInvoice = async (invoice, cars) => {
    setGeneratingPDF(true);
    try {
      const doc = new jsPDF();
      const margin = 14;
      const pageWidth = doc.internal.pageSize.getWidth();
      let currentY = 20;

      // Header - Sender Company
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(31, 41, 55);
      doc.text(invoice.senderCompanyName.toUpperCase() || "COMPANY NAME", margin, currentY);
      currentY += 6;

      if (invoice.senderAddress) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(invoice.senderAddress, margin, currentY);
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
      doc.text(invoice.clientCompanyName.toUpperCase(), pageWidth / 2, currentY, { align: "center" });
      currentY += 8;

      // Invoice Number and Date
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100);
      const invoiceNoText = `INVOICE NO: ${invoice.invoiceNumber}`;
      const invoiceDateText = `DATE: ${formatDate(invoice.invoiceDate).toUpperCase()}`;
      doc.text(invoiceNoText, pageWidth - margin, currentY, { align: "right" });
      currentY += 5;
      doc.text(invoiceDateText, pageWidth - margin, currentY, { align: "right" });
      currentY += 10;

      // Table data
      const tableRows = cars.map((car, index) => [
        index + 1,
        formatDate(car.date),
        car.stockNo || "",
        car.companyName || invoice.clientCompanyName || "",
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
          content: invoice.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 }),
          styles: { fontStyle: "bold" },
        },
      ]);

      // Generate table
      autoTable(doc, {
        startY: currentY,
        head: [["SR", "DATE", "STOCK", "CLIENT NAME", "VEHICLE", "CHASSIS", "AMOUNT"]],
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
      
      if (invoice.vatPercentage > 0) {
        doc.text(`VAT (${invoice.vatPercentage}%):`, margin, finalY);
        doc.text(
          `R${invoice.vatAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
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
        `R${invoice.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
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
      if (invoice.descriptions && invoice.descriptions.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(31, 41, 55);
        doc.text("DESCRIPTIONS:", margin, finalY);
        finalY += 6;
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        invoice.descriptions.forEach((desc) => {
          if (desc.trim()) {
            doc.text(`• ${desc}`, margin + 5, finalY);
            finalY += 5;
          }
        });
      }

      const fileName = `Invoice_${invoice.invoiceNumber}_${new Date(invoice.invoiceDate).toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF");
    } finally {
      setGeneratingPDF(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Compact Search Bar */}
        <div className="p-2 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by invoice number..."
                className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="w-48">
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">All Companies</option>
                {companies.map((company) => (
                  <option key={company._id} value={company.name}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            {(searchQuery || selectedCompany) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Invoices Table */}
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No invoices found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sender Company</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(invoice.invoiceDate)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {invoice.clientCompanyName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {invoice.senderCompanyName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-green-600">
                      R {invoice.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleViewInvoice(invoice)}
                          className="text-blue-600 hover:text-blue-800"
                          title="View Invoice"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            handleViewInvoice(invoice);
                            setTimeout(() => {
                              if (invoiceCars.length > 0) {
                                generatePDFFromInvoice(invoice, invoiceCars);
                              }
                            }, 500);
                          }}
                          disabled={generatingPDF}
                          className="text-green-600 hover:text-green-800 disabled:opacity-50"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleDeleteInvoice(invoice._id, invoice.invoiceNumber)}
                            disabled={deletingInvoiceId === invoice._id}
                            className="text-red-600 hover:text-red-800 disabled:opacity-50"
                            title="Delete Invoice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total > 0 && (
          <div className="p-4 border-t bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-sm text-gray-600">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total} invoices
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const newParams = new URLSearchParams(params.toString());
                  newParams.set("page", (pagination.page - 1).toString());
                  router.push(`/invoices?${newParams.toString()}`);
                }}
                disabled={!pagination.hasPrevPage}
                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-sm text-gray-700">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => {
                  const newParams = new URLSearchParams(params.toString());
                  newParams.set("page", (pagination.page + 1).toString());
                  router.push(`/invoices?${newParams.toString()}`);
                }}
                disabled={!pagination.hasNextPage}
                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invoice View Modal */}
      {viewingInvoice && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-lg shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 z-10">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Invoice {viewingInvoice.invoiceNumber}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatDate(viewingInvoice.invoiceDate)} • {viewingInvoice.clientCompanyName}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (invoiceCars.length > 0) {
                        generatePDFFromInvoice(viewingInvoice, invoiceCars);
                      }
                    }}
                    disabled={generatingPDF || loadingCars || invoiceCars.length === 0}
                    className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    {generatingPDF ? "Generating..." : "PDF"}
                  </button>
                  <button
                    onClick={() => {
                      setViewingInvoice(null);
                      setInvoiceCars([]);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {loadingCars ? (
                <div className="text-center py-8 text-gray-500">Loading invoice details...</div>
              ) : invoiceCars.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No cars found for this invoice</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Sender</h3>
                      <p className="text-sm text-gray-900">{viewingInvoice.senderCompanyName}</p>
                      {viewingInvoice.senderAddress && (
                        <p className="text-sm text-gray-600 mt-1">{viewingInvoice.senderAddress}</p>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Client</h3>
                      <p className="text-sm text-gray-900">{viewingInvoice.clientCompanyName}</p>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 p-2 border-b">
                      <h3 className="font-semibold text-gray-800 text-sm">Invoice Items ({invoiceCars.length} cars)</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">SR</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Stock</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Vehicle</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Chassis</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {invoiceCars.map((car, index) => (
                            <tr key={car._id}>
                              <td className="px-3 py-2 text-gray-600">{index + 1}</td>
                              <td className="px-3 py-2 text-gray-600">{formatDate(car.date)}</td>
                              <td className="px-3 py-2 font-medium">{car.stockNo}</td>
                              <td className="px-3 py-2">{car.name}</td>
                              <td className="px-3 py-2 font-mono text-xs">{car.chassis}</td>
                              <td className="px-3 py-2 text-right text-green-600 font-semibold">
                                R {(car.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan="5" className="px-3 py-2 text-right font-semibold">Subtotal:</td>
                            <td className="px-3 py-2 text-right font-semibold text-green-600">
                              R {viewingInvoice.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          {viewingInvoice.vatPercentage > 0 && (
                            <tr>
                              <td colSpan="5" className="px-3 py-2 text-right font-semibold">
                                VAT ({viewingInvoice.vatPercentage}%):
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-green-600">
                                R {viewingInvoice.vatAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td colSpan="5" className="px-3 py-2 text-right font-bold">Total:</td>
                            <td className="px-3 py-2 text-right font-bold text-green-600">
                              R {viewingInvoice.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {viewingInvoice.descriptions && viewingInvoice.descriptions.length > 0 && (
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-800 text-sm mb-2">Descriptions</h3>
                      <ul className="list-disc list-inside space-y-1">
                        {viewingInvoice.descriptions.map((desc, index) => (
                          <li key={index} className="text-sm text-gray-700">{desc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
