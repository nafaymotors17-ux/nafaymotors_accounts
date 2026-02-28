import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Generate receipt PDF from receipt data
 * @param {Object} receipt - Receipt object
 * @param {Object} invoice - Invoice object (optional, for reference)
 * @returns {jsPDF} PDF document
 */
export function generateReceiptPDF(receipt, invoice = null) {
  const doc = new jsPDF();
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 20;
  let currentY = 20;

  const addPageIfNeeded = (y, spaceNeeded = 10) => {
    if (y + spaceNeeded > pageHeight - bottomMargin) {
      doc.addPage();
      return margin;
    }
    return y;
  };

  const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // Header - Sender Company
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(31, 41, 55);
  doc.text(
    receipt.senderCompanyName.toUpperCase() || "COMPANY NAME",
    margin,
    currentY,
  );
  currentY += 6;

  if (receipt.senderAddress) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(receipt.senderAddress, margin, currentY);
    currentY += 5;
  }

  // Bank details if available
  if (receipt.senderBankDetails) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(receipt.senderBankDetails, margin, currentY);
    currentY += 5;
  }

  // RECEIPT Title
  currentY += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(31, 41, 55);
  doc.text("RECEIPT", pageWidth / 2, currentY, { align: "center" });
  currentY += 8;

  // Receipt Details Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);
  doc.text("Receipt Details", margin, currentY);
  currentY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0);

  const detailsLineHeight = 5;

  // Receipt number
  doc.text(`Receipt No: ${receipt.receiptNumber}`, margin, currentY);
  currentY += detailsLineHeight;

  // Receipt date
  doc.text(
    `Receipt Date: ${formatDate(receipt.receiptDate)}`,
    margin,
    currentY,
  );
  currentY += detailsLineHeight;

  // Invoice reference
  doc.text(`Invoice No: ${receipt.invoiceNumber}`, margin, currentY);
  currentY += detailsLineHeight;

  // Invoice date
  doc.text(
    `Invoice Date: ${formatDate(receipt.invoiceDate)}`,
    margin,
    currentY,
  );
  currentY += detailsLineHeight;

  // Client company name
  currentY += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Customer:", margin, currentY);
  currentY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(receipt.clientCompanyName.toUpperCase(), margin + 5, currentY);
  currentY += 8;

  // Payment Details Section
  currentY = addPageIfNeeded(currentY, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);
  doc.text("Payment Details", margin, currentY);
  currentY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0);

  // Payment amount table
  const paymentRows = [
    [
      "Invoice Amount:",
      `R${receipt.invoiceAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    ],
    [
      "Payment Method:",
      receipt.paymentMethod === "Bank" && receipt.accountInfo
        ? `Bank (${receipt.accountInfo})`
        : receipt.paymentMethod,
    ],
    ["Payment Date:", formatDate(receipt.paymentDate)],
  ];

  let tableY = currentY;
  paymentRows.forEach((row) => {
    doc.text(row[0], margin, tableY);
    doc.text(row[1], margin + 70, tableY);
    tableY += 5;
  });

  currentY = tableY + 5;

  // Amount paid section
  currentY = addPageIfNeeded(currentY, 20);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);
  doc.text("Amount Paid:", margin, currentY);
  doc.text(
    `R${receipt.paymentAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    pageWidth - margin,
    currentY,
    { align: "right" },
  );
  currentY += 7;

  // Applied to invoice
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Applied to Invoice:", margin, currentY);
  doc.text(
    `R${receipt.amountApplied.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    pageWidth - margin,
    currentY,
    { align: "right" },
  );
  currentY += 5;

  // Excess/Credit amount if applicable
  if (receipt.excessAmount > 0) {
    doc.text("Added to Credit:", margin, currentY);
    doc.text(
      `R${receipt.excessAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      pageWidth - margin,
      currentY,
      { align: "right" },
    );
    currentY += 7;
  }

  // Notes section if available
  if (receipt.notes && receipt.notes.trim()) {
    currentY = addPageIfNeeded(currentY, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.text("Notes:", margin, currentY);
    currentY += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0);
    const noteLines = doc.splitTextToSize(
      receipt.notes,
      pageWidth - 2 * margin,
    );
    doc.text(noteLines, margin, currentY);
    currentY += noteLines.length * 5 + 5;
  }

  // Footer
  currentY = pageHeight - bottomMargin;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("This is a computer-generated receipt", margin, currentY);
  doc.text(
    `Generated on ${formatDate(new Date())}`,
    pageWidth - margin,
    currentY,
    { align: "right" },
  );

  return doc;
}

/**
 * Download receipt PDF
 * @param {Object} receipt - Receipt object
 * @param {Object} invoice - Invoice object (optional)
 */
export function downloadReceiptPDF(receipt, invoice = null) {
  const doc = generateReceiptPDF(receipt, invoice);
  const fileName = `${receipt.receiptNumber}.pdf`;
  doc.save(fileName);
}
