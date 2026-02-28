"use server";

import { revalidatePath } from "next/cache";
import connectDB from "../dbConnect";
import Receipt from "../models/Receipt";
import Invoice from "../models/Invoice";
import { getSession } from "../auth/getSession";

// Generate unique receipt number (format: RCP-YYYYMMDD-XXX)
async function generateReceiptNumber(maxRetries = 10) {
  await connectDB();
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const prefix = `RCP-${year}${month}${day}-`;

  // Find the highest number for today
  const todayReceipts = await Receipt.find({
    receiptNumber: {
      $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    },
  })
    .sort({ receiptNumber: -1 })
    .limit(1)
    .lean();

  let baseSequence = 1;
  if (todayReceipts.length > 0) {
    const lastNumber = todayReceipts[0].receiptNumber;
    const lastSequence = parseInt(lastNumber.split("-")[2]) || 0;
    baseSequence = lastSequence + 1;
  }

  // Try to find a unique receipt number
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const sequence = baseSequence + attempt;
    const receiptNumber = `${prefix}${String(sequence).padStart(3, "0")}`;

    const existingReceipt = await Receipt.findOne({ receiptNumber }).lean();
    if (!existingReceipt) {
      return receiptNumber;
    }

    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}${timestamp}`;
}

/**
 * Create a receipt when a payment is recorded
 * This is automatically called when a payment is added to an invoice
 */
export async function createReceipt(receiptData) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    // Get invoice details
    const invoice = await Invoice.findById(receiptData.invoiceId);
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    // Get payment details from invoice.payments array
    const payment = invoice.payments[receiptData.paymentIndex];
    if (!payment) {
      return { success: false, error: "Payment not found" };
    }

    // Generate receipt number
    const receiptNumber = await generateReceiptNumber();

    // Create receipt
    const receipt = new Receipt({
      receiptNumber,
      invoiceId: receiptData.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      paymentIndex: receiptData.paymentIndex,
      userId: session.userId,
      senderCompanyName: invoice.senderCompanyName,
      senderAddress: invoice.senderAddress,
      senderBankDetails: receiptData.senderBankDetails || "",
      clientCompanyName: invoice.clientCompanyName,
      paymentAmount: payment.amount,
      amountApplied: payment.amount - (payment.excessAmount || 0),
      excessAmount: payment.excessAmount || 0,
      paymentMethod: payment.paymentMethod || "Cash",
      accountInfo: payment.accountInfo || "",
      paymentDate: payment.paymentDate,
      invoiceDate: invoice.invoiceDate,
      invoiceAmount: invoice.totalAmount,
      notes: payment.notes || "",
      recordedBy: payment.recordedBy || session.userId,
      status: "generated",
    });

    await receipt.save();

    revalidatePath("/invoices");

    return {
      success: true,
      receipt: JSON.parse(JSON.stringify(receipt)),
    };
  } catch (error) {
    console.error("Error creating receipt:", error);
    return {
      success: false,
      error: error.message || "Failed to create receipt",
    };
  }
}

/**
 * Get all receipts for a specific invoice
 */
export async function getReceiptsByInvoice(invoiceId) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { receipts: [] };
    }

    const receipts = await Receipt.find({ invoiceId })
      .sort({ receiptDate: -1 })
      .populate("userId", "name email")
      .populate("recordedBy", "name email")
      .lean();

    return {
      success: true,
      receipts: JSON.parse(JSON.stringify(receipts)),
    };
  } catch (error) {
    console.error("Error fetching receipts:", error);
    return {
      success: false,
      receipts: [],
      error: error.message,
    };
  }
}

/**
 * Get a single receipt by ID
 */
export async function getReceiptById(receiptId) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const receipt = await Receipt.findById(receiptId)
      .populate("invoiceId")
      .populate("userId", "name email")
      .populate("recordedBy", "name email")
      .lean();

    if (!receipt) {
      return { success: false, error: "Receipt not found" };
    }

    return {
      success: true,
      receipt: JSON.parse(JSON.stringify(receipt)),
    };
  } catch (error) {
    console.error("Error fetching receipt:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Update receipt status (sent, archived, etc.)
 */
export async function updateReceiptStatus(receiptId, status, sentTo = null) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const receipt = await Receipt.findByIdAndUpdate(
      receiptId,
      {
        status,
        ...(status === "sent" && {
          sentAt: new Date(),
          sentTo: sentTo,
        }),
        updatedAt: new Date(),
      },
      { new: true },
    ).lean();

    if (!receipt) {
      return { success: false, error: "Receipt not found" };
    }

    revalidatePath("/invoices");

    return {
      success: true,
      receipt: JSON.parse(JSON.stringify(receipt)),
    };
  } catch (error) {
    console.error("Error updating receipt status:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Delete a receipt
 */
export async function deleteReceipt(receiptId) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const receipt = await Receipt.findByIdAndDelete(receiptId);

    if (!receipt) {
      return { success: false, error: "Receipt not found" };
    }

    revalidatePath("/invoices");

    return {
      success: true,
      message: "Receipt deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting receipt:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get all receipts for a company
 */
export async function getReceiptsByCompany(companyName) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { receipts: [] };
    }

    const receipts = await Receipt.find({
      clientCompanyName: companyName.toUpperCase().trim(),
    })
      .sort({ receiptDate: -1 })
      .populate("userId", "name email")
      .lean();

    return {
      success: true,
      receipts: JSON.parse(JSON.stringify(receipts)),
    };
  } catch (error) {
    console.error("Error fetching company receipts:", error);
    return {
      success: false,
      receipts: [],
      error: error.message,
    };
  }
}
