"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Download, Trash2 } from "lucide-react";
import { formatDate } from "@/app/lib/utils/dateFormat";
import { deleteInvoice, recordPayment, deletePayment } from "@/app/lib/invoice-actions/invoices";
import { getCarsByCompany } from "@/app/lib/carriers-actions/cars";
import { getCompanyBalance } from "@/app/lib/invoice-actions/company-balances";
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
  totals,
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
  const { user, fullUserData } = useUser();
  const queryClient = useQueryClient();

  // Derived value with useMemo
  const isSuperAdmin = useMemo(() => user?.role === "super_admin", [user?.role]);
  
  // Check if user can delete invoice (super admin or invoice owner)
  const canDeleteInvoice = useCallback((invoice) => {
    if (isSuperAdmin) return true;
    if (!user || !invoice) return false;
    return invoice.userId?.toString() === user.userId?.toString();
  }, [isSuperAdmin, user]);

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

  // Fetch company balance when viewing invoice
  const {
    data: companyBalanceData,
    isLoading: loadingCompanyBalance,
  } = useQuery({
    queryKey: ["companyBalance", viewingInvoice?.clientCompanyName],
    queryFn: () => {
      if (!viewingInvoice?.clientCompanyName) return null;
      return getCompanyBalance(viewingInvoice.clientCompanyName);
    },
    enabled: !!viewingInvoice?.clientCompanyName,
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
      queryClient.invalidateQueries({ queryKey: ["companyBalance"] });
      queryClient.invalidateQueries({ queryKey: ["company-balances"] });
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
      queryClient.invalidateQueries({ queryKey: ["companyBalance"] });
      queryClient.invalidateQueries({ queryKey: ["company-balances"] });
      if (data.invoice) {
        setViewingInvoice(data.invoice);
      }
    },
  });

  // Helper functions
  const getPaymentInfo = useCallback((invoice) => {
    const payments = invoice.payments || [];
    // Calculate total applied to invoice (amount - excessAmount)
    const totalPaid = payments.reduce((sum, p) => {
      const appliedAmount = (p.amount || 0) - (p.excessAmount || 0);
      return sum + appliedAmount;
    }, 0);
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
    } else {
      return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>Unpaid</span>;
    }
  }, []);


  // Event handlers
  const handleClearFilters = useCallback(() => {
    onSearchChange("");
    onCompanyChange("");
    onPaymentStatusChange("");
  }, [onSearchChange, onCompanyChange, onPaymentStatusChange]);

  const handleDeleteInvoice = useCallback(
    async (invoiceId, invoiceNumber) => {
      const confirmed = window.confirm(
        `Are you sure you want to delete invoice ${invoiceNumber}? This action cannot be undone.`
      );
      if (!confirmed) return;
      deleteInvoiceMutation.mutate(invoiceId);
    },
    [deleteInvoiceMutation]
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
      // Get sender (user) bank details from user context
      const senderBankDetails = fullUserData?.bankDetails?.trim() || "";

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

      // Payment Information Section
      const paymentInfo = getPaymentInfo(invoice);
      // Always show payment information section
      // Add a separator line
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, finalY, pageWidth - margin, finalY);
      finalY += 8;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(31, 41, 55);
        doc.text("PAYMENT INFORMATION:", margin, finalY);
        finalY += 8;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);

        // Total Paid
        doc.text("Total Paid:", margin, finalY);
        doc.setFont("helvetica", "bold");
        doc.text(
          `R${paymentInfo.totalPaid.toLocaleString("en-US", {
            minimumFractionDigits: 2,
          })}`,
          pageWidth - margin,
          finalY,
          { align: "right" }
        );
        finalY += 6;

        // Remaining Balance
        doc.setFont("helvetica", "normal");
        doc.text("Remaining Balance:", margin, finalY);
        doc.setFont("helvetica", "bold");
        // Color code remaining balance (red if > 0, green if 0)
        if (paymentInfo.remainingBalance > 0) {
          doc.setTextColor(220, 38, 38); // Red color
        } else {
          doc.setTextColor(34, 197, 94); // Green color
        }
        doc.text(
          `R${paymentInfo.remainingBalance.toLocaleString("en-US", {
            minimumFractionDigits: 2,
          })}`,
          pageWidth - margin,
          finalY,
          { align: "right" }
        );
        doc.setTextColor(0, 0, 0); // Reset color
        finalY += 6;

        // Payment Status
        doc.setFont("helvetica", "normal");
        doc.text("Payment Status:", margin, finalY);
        doc.setFont("helvetica", "bold");
        const statusText = paymentInfo.paymentStatus.toUpperCase();
        doc.text(statusText, pageWidth - margin, finalY, { align: "right" });
        finalY += 8;

      finalY += 4;

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
        finalY += 3;
      }

      // Bank Details section
      if (senderBankDetails) {
        finalY += 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(31, 41, 55);
        doc.text("BANK DETAILS:", margin, finalY);
        finalY += 6;
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100);
        const bankLines = senderBankDetails.split('\n');
        bankLines.forEach((line) => {
          if (line.trim()) {
            doc.text(line.trim(), margin + 5, finalY);
            finalY += 4;
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
  }, [getPaymentInfo, fullUserData]);

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
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Invoice #
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Client Company
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Sender Company
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Trip(s)
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Paid
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Balance
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => {
                  const paymentInfo = getPaymentInfo(invoice);
                  return (
                    <tr key={invoice._id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                        {formatDate(invoice.invoiceDate)}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {invoice.clientCompanyName}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {invoice.senderCompanyName}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {invoice.tripNumbers && invoice.tripNumbers.length > 0 ? (
                          <div className="space-y-1">
                            <button
                              onClick={() => {
                                const trips = invoice.tripNumbers.map((tripNumber, idx) => ({
                                  tripNumber,
                                  date: invoice.tripDates && invoice.tripDates[idx] ? invoice.tripDates[idx] : null,
                                  tripId: invoice.tripIds && invoice.tripIds[idx] ? invoice.tripIds[idx] : null,
                                  truckNumber: invoice.truckNumbers && invoice.truckNumbers[idx] ? invoice.truckNumbers[idx] : null,
                                }));
                                setSelectedTrips(trips);
                              }}
                              className="text-left text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition-colors cursor-pointer hover:shadow-sm"
                              title="Click to view all trips"
                            >
                              <div className="flex items-center gap-1">
                                {invoice.tripNumbers[0] && (
                                  <a
                                    href={invoice.tripIds && invoice.tripIds.length > 0 && invoice.tripIds[0] 
                                      ? `/carrier-trips/${invoice.tripIds[0]}`
                                      : `/carrier-trips?tripNumber=${encodeURIComponent(invoice.tripNumbers[0])}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (invoice.tripIds && invoice.tripIds.length > 0 && invoice.tripIds[0]) {
                                        window.open(`/carrier-trips/${invoice.tripIds[0]}`, '_blank');
                                      } else {
                                        window.open(`/carrier-trips?tripNumber=${encodeURIComponent(invoice.tripNumbers[0])}`, '_blank');
                                      }
                                    }}
                                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {invoice.tripNumbers[0]}
                                  </a>
                                )}
                                {invoice.tripDates && invoice.tripDates[0] && (
                                  <span className="text-gray-500">/{formatDate(invoice.tripDates[0])}</span>
                                )}
                                {invoice.tripNumbers.length > 1 && (
                                  <span className="ml-1 text-gray-500">...</span>
                                )}
                              </div>
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-right font-semibold text-green-600">
                        R{" "}
                        {invoice.totalAmount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-right">
                        {(() => {
                          const totalExcess = (paymentInfo.payments || []).reduce(
                            (sum, payment) => sum + (payment.excessAmount || 0),
                            0
                          );
                          return (
                            <div>
                              <div className="text-blue-600 font-semibold">
                                R{" "}
                                {paymentInfo.totalPaid.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                })}
                              </div>
                              {totalExcess > 0 && (
                                <div className="text-[10px] text-blue-400 mt-0.5">
                                  (+R{totalExcess.toLocaleString("en-US", { minimumFractionDigits: 2 })})
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-right font-semibold">
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
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        {getPaymentStatusBadge(
                          paymentInfo.paymentStatus,
                          paymentInfo.remainingBalance
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-center">
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
                          {canDeleteInvoice(invoice) && (
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
                {/* Totals Row - Shows totals for entire filtered dataset */}
                {totals && invoices.length > 0 && (
                  <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold">
                    <td colSpan="5" className="px-3 py-2 text-xs text-right font-semibold text-gray-700">
                      TOTALS (All {pagination?.total || 0} invoices):
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-right font-bold text-green-700">
                      R{" "}
                      {totals.totalAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-right font-bold text-blue-700">
                      R{" "}
                      {totals.totalPaid.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-right font-bold">
                      <span
                        className={
                          totals.totalBalance > 0 ? "text-red-700" : "text-green-700"
                        }
                      >
                        R{" "}
                        {totals.totalBalance.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                    <td colSpan="3" className="px-3 py-2"></td>
                  </tr>
                )}
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
          companyBalance={companyBalanceData}
          loadingCompanyBalance={loadingCompanyBalance}
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
