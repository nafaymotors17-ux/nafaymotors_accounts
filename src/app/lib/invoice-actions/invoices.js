"use server";

import { revalidatePath } from "next/cache";
import connectDB from "../dbConnect";
import Invoice from "../models/Invoice";
import { getSession } from "../auth/getSession";
import mongoose from "mongoose";

// Generate unique invoice number (format: INV-YYYYMMDD-XXX)
async function generateInvoiceNumber() {
  await connectDB();
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const prefix = `INV-${year}${month}${day}-`;

  // Find the highest number for today
  const todayInvoices = await Invoice.find({
    invoiceNumber: { $regex: `^${prefix}` },
  })
    .sort({ invoiceNumber: -1 })
    .limit(1)
    .lean();

  let sequence = 1;
  if (todayInvoices.length > 0) {
    const lastNumber = todayInvoices[0].invoiceNumber;
    const lastSequence = parseInt(lastNumber.split("-")[2]) || 0;
    sequence = lastSequence + 1;
  }

  return `${prefix}${String(sequence).padStart(3, "0")}`;
}

export async function createInvoice(invoiceData) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    // Generate unique invoice number
    const invoiceNumber = await generateInvoiceNumber();

    const invoice = new Invoice({
      invoiceNumber,
      userId: session.userId,
      senderCompanyName: invoiceData.senderCompanyName,
      senderAddress: invoiceData.senderAddress || "",
      clientCompanyName: invoiceData.clientCompanyName,
      invoiceDate: invoiceData.invoiceDate || new Date(),
      startDate: new Date(invoiceData.startDate),
      endDate: new Date(invoiceData.endDate),
      carIds: invoiceData.carIds || [],
      subtotal: invoiceData.subtotal || 0,
      vatPercentage: invoiceData.vatPercentage || 0,
      vatAmount: invoiceData.vatAmount || 0,
      totalAmount: invoiceData.totalAmount || 0,
      descriptions: invoiceData.descriptions || [],
      isActive: invoiceData.isActive || "",
    });

    await invoice.save();
    revalidatePath("/invoices");

    return {
      success: true,
      invoice: JSON.parse(JSON.stringify(invoice)),
    };
  } catch (error) {
    return { success: false, error: "Failed to create invoice" };
  }
}

export async function getInvoices(searchParams = {}) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { invoices: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } };
    }

    const page = parseInt(searchParams.page) || 1;
    const limit = parseInt(searchParams.limit) || 10;
    const skip = (page - 1) * limit;
    const search = searchParams.search || "";
    const company = searchParams.company || "";

    // Build query - users can only see their own invoices
    const query = {};
    if (session.role !== "super_admin") {
      if (mongoose.Types.ObjectId.isValid(session.userId)) {
        query.userId = new mongoose.Types.ObjectId(session.userId);
      }
    }

    // Filter by company (client company name)
    if (company) {
      query.clientCompanyName = { $regex: `^${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: "i" };
    }

    // Search across invoice number and sender company (not client company if company filter is set)
    if (search) {
      const searchConditions = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { senderCompanyName: { $regex: search, $options: "i" } },
      ];
      // Only add client company to search if company filter is not set
      if (!company) {
        searchConditions.push({ clientCompanyName: { $regex: search, $options: "i" } });
      }
      query.$or = searchConditions;
    }

    // Get invoices with pagination
    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort({ invoiceDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      invoices: JSON.parse(JSON.stringify(invoices)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  } catch (error) {
    return {
      invoices: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
    };
  }
}

export async function getInvoiceById(invoiceId) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const invoice = await Invoice.findById(invoiceId).lean();
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    // Check if user has permission (owner or super admin)
    const invoiceUserId = invoice.userId?.toString();
    const sessionUserId = session.userId?.toString();

    if (session.role !== "super_admin" && invoiceUserId !== sessionUserId) {
      return { success: false, error: "Unauthorized to view this invoice" };
    }

    return {
      success: true,
      invoice: JSON.parse(JSON.stringify(invoice)),
    };
  } catch (error) {
    return { success: false, error: "Failed to fetch invoice" };
  }
}

export async function deleteInvoice(invoiceId) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    // Only super admin can delete invoices
    if (session.role !== "super_admin") {
      return { success: false, error: "Only super admin can delete invoices" };
    }

    const invoice = await Invoice.findByIdAndDelete(invoiceId);
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    revalidatePath("/invoices");
    return { success: true, message: "Invoice deleted successfully" };
  } catch (error) {
    return { success: false, error: "Failed to delete invoice" };
  }
}
