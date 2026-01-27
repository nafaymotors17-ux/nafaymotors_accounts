"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Download, Trash2 } from "lucide-react";
import { formatDate } from "@/app/lib/utils/dateFormat";
import { deleteInvoice, recordPayment, deletePayment } from "@/app/lib/invoice-actions/invoices";
import { getCarsByCompany } from "@/app/lib/carriers-actions/cars";
import { useUser } from "@/app/components/UserContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import InvoiceFilters from "./InvoiceFilters";
import InvoiceViewModal from "./InvoiceViewModal";
import PaymentFormModal from "./PaymentFormModal";
import TripDetailsModal from "./TripDetailsModal";

export default function InvoicesTable({
  invoices,
  pagination,
  companies = [],
  loading = false,
  searchQuery = "",
  selectedCompany = "",
  paymentStatus = "",
  onSearchChange,
  onCompanyChange,
  onPaymentStatusChange,
  onPageChange,
  onLimitChange,
  currentLimit = 10,
}) {
  const { user } = useUser();
  const queryClient = useQueryClient();

  // Derived value with useMemo
  const isSuperAdmin = useMemo(() => user?.role === "super_admin", [user?.role]);

  // UI state only
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedTrips, setSelectedTrips] = useState(null);
  const [paymentFormData, setPaymentFormData] = useState({
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Server data with React Query - fetch cars when viewing invoice
  const {
    data: invoiceCarsData,
    isLoading: loadingCars,
  } = useQuery({
    queryKey: ["invoiceCars", viewingInvoice?._id],
    queryFn: () => {
      if (!viewingInvoice) return null;
      return getCarsByCompany({
        companyName: viewingInvoice.clientCompanyName,
        startDate: viewingInvoice.startDate,
        endDate: viewingInvoice.endDate,
        isActive: viewingInvoice.isActive,
      });
    },
    enabled: !!viewingInvoice,
  });

  // Derived value - filtered cars for the invoice
  const invoiceCars = useMemo(() => {
    if (!invoiceCarsData?.success || !viewingInvoice) return [];
    const invoiceCarIds = viewingInvoice.carIds.map((id) => id.toString());
    return (invoiceCarsData.cars || []).filter((car) =>
      invoiceCarIds.includes(car._id.toString())
    );
  }, [invoiceCarsData, viewingInvoice]);

  // Mutations
  const deleteInvoiceMutation = useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setViewingInvoice(null);
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: ({ invoiceId, paymentData }) => recordPayment(invoiceId, paymentData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if (data.invoice) {
        setViewingInvoice(data.invoice);
      }
      setShowPaymentForm(false);
      setPaymentFormData({
        amount: "",
        paymentDate: new Date().toISOString().split("T")[0],
        notes: "",
      });
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: ({ invoiceId, paymentId }) => deletePayment(invoiceId, paymentId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if (data.invoice) {
        setViewingInvoice(data.invoice);
      }
    },
  });

  // Helper functions
  const getPaymentInfo = useCallback((invoice) => {
    const payments = invoice.payments || [];
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalAmount = invoice.totalAmount || 0;
    const remainingBalance = totalAmount - totalPaid;
    const paymentStatus = invoice.paymentStatus || "unpaid";

    return {
      totalPaid,
      remainingBalance,
      paymentStatus,
      payments,
      isPaid: totalPaid >= totalAmount,
      isPartial: totalPaid > 0 && totalPaid < totalAmount,
    };
  }, []);

  const getPaymentStatusBadge = useCallback((status, remainingBalance) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded";
    if (status === "paid") {
      return <span className={`${baseClasses} bg-green-100 text-green-800`}>Paid</span>;
    } else if (status === "partial") {
      return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>Partial</span>;
    } else if (status === "overdue") {
      return <span className={`${baseClasses} bg-red-100 text-red-800`}>Overdue</span>;
    } else {
      return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>Unpaid</span>;
    }
  }, []);

  const getDaysOverdue = useCallback((invoice) => {
    if (!invoice.dueDate) return null;
    const dueDate = new Date(invoice.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = today - dueDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, []);

  // Event handlers
  const handleClearFilters = useCallback(() => {
    onSearchChange("");
    onCompanyChange("");
    onPaymentStatusChange("");
  }, [onSearchChange, onCompanyChange, onPaymentStatusChange]);

  const handleDeleteInvoice = useCallback(
    async (invoiceId, invoiceNumber) => {
      if (!isSuperAdmin) return;
      const confirmed = window.confirm(
        `Are you sure you want to delete invoice ${invoiceNumber}? This action cannot be undone.`
      );
      if (!confirmed) return;
      deleteInvoiceMutation.mutate(invoiceId);
    },
    [isSuperAdmin, deleteInvoiceMutation]
  );

  const handleViewInvoice = useCallback((invoice) => {
    setViewingInvoice(invoice);
  }, []);

  const handleCloseModal = useCallback(() => {
    setViewingInvoice(null);
  }, []);

  const generatePDFFromInvoice = useCallback(async (invoice, cars) => {
    if (!cars || cars.length === 0) return;
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
      doc.text(
        invoice.senderCompanyName.toUpperCase() || "COMPANY NAME",
        margin,
        currentY
      );
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
      doc.text(
        invoice.clientCompanyName.toUpperCase(),
        pageWidth / 2,
        currentY,
        { align: "center" }
      );
      currentY += 8;

      // Invoice Number and Date
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100);
      const invoiceNoText = `INVOICE NO: ${invoice.invoiceNumber}`;
      const invoiceDateText = `DATE: ${formatDate(invoice.invoiceDate).toUpperCase()}`;
      doc.text(invoiceNoText, pageWidth - margin, currentY, { align: "right" });
      currentY += 5;
      doc.text(invoiceDateText, pageWidth - margin, currentY, {
        align: "right",
      });
      currentY += 10;

      // Table data
      const tableRows = cars.map((car, index) => [
        index + 1,
        formatDate(car.date),
        car.stockNo || "",
        car.companyName || invoice.clientCompanyName || "",
        car.name || "",
        car.chassis || "",
        (car.amount || 0).toLocaleString("en-US", {
          minimumFractionDigits: 2,
        }),
      ]);

      // Add TOTAL row
      tableRows.push([
        {
          content: "TOTAL",
          colSpan: 6,
          styles: { halign: "right", fontStyle: "bold" },
        },
        {
          content: invoice.subtotal.toLocaleString("en-US", {
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

      if (invoice.vatPercentage > 0) {
        doc.text(`VAT (${invoice.vatPercentage}%):`, margin, finalY);
        doc.text(
          `R${invoice.vatAmount.toLocaleString("en-US", {
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
        `R${invoice.totalAmount.toLocaleString("en-US", {
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
      doc.text(
        "* THANK YOU FOR DOING BUSINESS WITH US...!!",
        pageWidth / 2,
        finalY,
        { align: "center" }
      );
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

      const fileName = `Invoice_${invoice.invoiceNumber}_${new Date(
        invoice.invoiceDate
      )
        .toISOString()
        .split("T")[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF");
    } finally {
      setGeneratingPDF(false);
    }
  }, []);

  const handleDownloadPDF = useCallback(() => {
    if (viewingInvoice && invoiceCars.length > 0) {
      generatePDFFromInvoice(viewingInvoice, invoiceCars);
    }
  }, [viewingInvoice, invoiceCars, generatePDFFromInvoice]);

  const handleViewAndDownload = useCallback(
    (invoice) => {
      handleViewInvoice(invoice);
      setTimeout(() => {
        if (invoiceCars.length > 0) {
          generatePDFFromInvoice(invoice, invoiceCars);
        }
      }, 500);
    },
    [handleViewInvoice, invoiceCars, generatePDFFromInvoice]
  );

  const handleRecordPayment = useCallback(() => {
    setShowPaymentForm(true);
  }, []);

  const handleRecordPaymentSubmit = useCallback(
    (paymentData) => {
      if (!viewingInvoice) return;
      recordPaymentMutation.mutate({
        invoiceId: viewingInvoice._id,
        paymentData,
      });
    },
    [viewingInvoice, recordPaymentMutation]
  );

  const handleDeletePayment = useCallback(
    (invoiceId, paymentId) => {
      deletePaymentMutation.mutate({ invoiceId, paymentId });
    },
    [deletePaymentMutation]
  );

  // Derived values
  const paginationInfo = useMemo(() => {
    if (!pagination) return null;
    return {
      start: (pagination.page - 1) * pagination.limit + 1,
      end: Math.min(pagination.page * pagination.limit, pagination.total),
      total: pagination.total,
    };
  }, [pagination]);

  const viewingInvoicePaymentInfo = useMemo(() => {
    if (!viewingInvoice) return null;
    return getPaymentInfo(viewingInvoice);
  }, [viewingInvoice, getPaymentInfo]);

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <InvoiceFilters
          searchQuery={searchQuery}
          selectedCompany={selectedCompany}
          paymentStatus={paymentStatus}
          companies={companies}
          onSearchChange={onSearchChange}
          onCompanyChange={onCompanyChange}
          onPaymentStatusChange={onPaymentStatusChange}
          onClearFilters={handleClearFilters}
        />

        {/* Invoices Table */}
        {loading && !pagination ? (
          <div className="p-8 text-center text-gray-500">
            <p>Loading invoices...</p>
          </div>
        ) : !loading && invoices.length === 0 && pagination ? (
          <div className="p-8 text-center text-gray-500">
            <p>No invoices found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Invoice #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Client Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Sender Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Trip(s)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Paid
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Days Overdue
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => {
                  const paymentInfo = getPaymentInfo(invoice);
                  return (
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
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {invoice.tripNumbers && invoice.tripNumbers.length > 0 ? (
                          <button
                            onClick={() => {
                              const trips = invoice.tripNumbers.map((tripNumber, idx) => ({
                                tripNumber,
                                date: invoice.tripDates && invoice.tripDates[idx] ? invoice.tripDates[idx] : null,
                              }));
                              setSelectedTrips(trips);
                            }}
                            className="text-left text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition-colors cursor-pointer hover:shadow-sm"
                            title="Click to view all trips"
                          >
                            {invoice.tripNumbers[0]}
                            {invoice.tripDates && invoice.tripDates[0] && (
                              <>/{formatDate(invoice.tripDates[0])}</>
                            )}
                            {invoice.tripNumbers.length > 1 && (
                              <span className="ml-1">...</span>
                            )}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-green-600">
                        R{" "}
                        {invoice.totalAmount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600">
                        R{" "}
                        {paymentInfo.totalPaid.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                        <span
                          className={
                            paymentInfo.remainingBalance > 0
                              ? "text-red-600"
                              : "text-green-600"
                          }
                        >
                          R{" "}
                          {paymentInfo.remainingBalance.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getPaymentStatusBadge(
                          paymentInfo.paymentStatus,
                          paymentInfo.remainingBalance
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-xs">
                        {(() => {
                          const daysOverdue = getDaysOverdue(invoice);
                          if (daysOverdue === null)
                            return <span className="text-gray-400">-</span>;
                          if (daysOverdue > 0 && paymentInfo.remainingBalance > 0) {
                            return (
                              <span className="text-red-600 font-semibold">
                                {daysOverdue} days
                              </span>
                            );
                          } else if (
                            daysOverdue <= 0 &&
                            paymentInfo.remainingBalance > 0
                          ) {
                            return (
                              <span className="text-yellow-600">
                                {Math.abs(daysOverdue)} days left
                              </span>
                            );
                          } else {
                            return <span className="text-gray-400">-</span>;
                          }
                        })()}
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
                            onClick={() => handleViewAndDownload(invoice)}
                            disabled={generatingPDF}
                            className="text-green-600 hover:text-green-800 disabled:opacity-50"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {isSuperAdmin && (
                            <button
                              onClick={() =>
                                handleDeleteInvoice(invoice._id, invoice.invoiceNumber)
                              }
                              disabled={deleteInvoiceMutation.isPending}
                              className="text-red-600 hover:text-red-800 disabled:opacity-50"
                              title="Delete Invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total > 0 && paginationInfo && (
          <div className="p-4 border-t bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">
                Showing {paginationInfo.start} to {paginationInfo.end} of{" "}
                {paginationInfo.total} invoices
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Show:</label>
                <select
                  value={currentLimit}
                  onChange={(e) => onLimitChange(Number(e.target.value))}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={!pagination.hasPrevPage}
                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-sm text-gray-700">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => onPageChange(pagination.page + 1)}
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
      {viewingInvoice && viewingInvoicePaymentInfo && (
        <InvoiceViewModal
          invoice={viewingInvoice}
          invoiceCars={invoiceCars}
          loadingCars={loadingCars}
          generatingPDF={generatingPDF}
          paymentInfo={viewingInvoicePaymentInfo}
          getPaymentStatusBadge={getPaymentStatusBadge}
          onClose={handleCloseModal}
          onDownloadPDF={handleDownloadPDF}
          onRecordPayment={handleRecordPayment}
          onDeletePayment={handleDeletePayment}
        />
      )}

      {/* Payment Form Modal */}
      {showPaymentForm && viewingInvoice && viewingInvoicePaymentInfo && (
        <PaymentFormModal
          invoice={viewingInvoice}
          getPaymentInfo={getPaymentInfo}
          onClose={() => setShowPaymentForm(false)}
          onRecordPayment={handleRecordPaymentSubmit}
          isPending={recordPaymentMutation.isPending}
        />
      )}


      {/* Trip Details Modal */}
      {selectedTrips && (
        <TripDetailsModal
          trips={selectedTrips}
          onClose={() => {
            setSelectedTrips(null);
          }}
        />
      )}
    </>
  );
}
