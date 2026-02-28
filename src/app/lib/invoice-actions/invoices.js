"use server";

import { revalidatePath } from "next/cache";
import connectDB from "../dbConnect";
import Invoice from "../models/Invoice";
import Car from "../models/Car";
import Carrier from "../models/Carrier";
import Company from "../models/Company";
import { getSession } from "../auth/getSession";
import mongoose from "mongoose";
import {
  updateCompanyCredit,
  updateCompanyDueBalance,
} from "./company-balances";
import { createReceipt } from "./receipts";

// Generate unique invoice number (format: INV-YYYYMMDD-XXX)
async function generateInvoiceNumber(maxRetries = 10) {
  await connectDB();
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const prefix = `INV-${year}${month}${day}-`;

  // Find the highest number for today
  const todayInvoices = await Invoice.find({
    invoiceNumber: {
      $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    },
  })
    .sort({ invoiceNumber: -1 })
    .limit(1)
    .lean();

  let baseSequence = 1;
  if (todayInvoices.length > 0) {
    const lastNumber = todayInvoices[0].invoiceNumber;
    const lastSequence = parseInt(lastNumber.split("-")[2]) || 0;
    baseSequence = lastSequence + 1;
  }

  // Try to find a unique invoice number, incrementing if needed
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const sequence = baseSequence + attempt;
    const invoiceNumber = `${prefix}${String(sequence).padStart(3, "0")}`;

    // Check if this invoice number already exists (double-check for race conditions)
    const existingInvoice = await Invoice.findOne({ invoiceNumber }).lean();
    if (!existingInvoice) {
      return invoiceNumber;
    }

    // If it exists, wait a bit before trying next sequence
    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  // If all retries failed, use timestamp-based fallback
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}${timestamp}`;
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

    // Invoice date
    const invoiceDate = invoiceData.invoiceDate
      ? new Date(invoiceData.invoiceDate)
      : new Date();

    // Extract trip information from cars
    const carIds = invoiceData.carIds || [];
    const tripNumbersSet = new Set();
    const tripIdsSet = new Set();
    const tripDatesSet = new Set();
    const truckNumbersMap = new Map(); // Map tripNumber to truckNumber

    if (carIds.length > 0) {
      // Fetch cars with their carrier and truck information
      const cars = await Car.find({ _id: { $in: carIds } })
        .populate({
          path: "carrier",
          select: "tripNumber name type date _id truck",
          populate: {
            path: "truck",
            select: "number",
          },
        })
        .lean();

      cars.forEach((car) => {
        if (car.carrier) {
          // Only track trips (not companies)
          if (car.carrier.type === "trip" && car.carrier.tripNumber) {
            tripNumbersSet.add(car.carrier.tripNumber);
            if (car.carrier._id) {
              tripIdsSet.add(car.carrier._id.toString());
            }
            if (car.carrier.date) {
              tripDatesSet.add(new Date(car.carrier.date).toISOString());
            }
            // Store truck number for this trip
            if (car.carrier.truck && car.carrier.truck.number) {
              truckNumbersMap.set(
                car.carrier.tripNumber,
                car.carrier.truck.number,
              );
            }
          }
        }
      });
    }

    // Create truckNumbers array matching tripNumbers order
    const truckNumbers = Array.from(tripNumbersSet)
      .map((tripNumber) => truckNumbersMap.get(tripNumber) || null)
      .filter((num) => num !== null);

    const invoice = new Invoice({
      invoiceNumber,
      userId: session.userId,
      senderCompanyName: invoiceData.senderCompanyName,
      senderAddress: invoiceData.senderAddress || "",
      clientCompanyName: invoiceData.clientCompanyName,
      invoiceDate: invoiceDate,
      startDate: new Date(invoiceData.startDate),
      endDate: new Date(invoiceData.endDate),
      carIds: carIds,
      subtotal: invoiceData.subtotal || 0,
      vatPercentage: invoiceData.vatPercentage || 0,
      vatAmount: invoiceData.vatAmount || 0,
      totalAmount: invoiceData.totalAmount || 0,
      descriptions: invoiceData.descriptions || [],
      isActive: invoiceData.isActive || "",
      tripNumbers: Array.from(tripNumbersSet),
      tripIds: Array.from(tripIdsSet).map(
        (id) => new mongoose.Types.ObjectId(id),
      ),
      tripDates: Array.from(tripDatesSet).map((dateStr) => new Date(dateStr)),
      truckNumbers: truckNumbers,
      payments: [], // Initialize empty payments array
      paymentStatus: "unpaid", // Initialize as unpaid
    });

    await invoice.save();

    // Add invoice amount to company's due balance
    const companyName = invoiceData.clientCompanyName?.toUpperCase().trim();
    if (companyName) {
      await updateCompanyDueBalance(
        companyName,
        invoice.totalAmount,
        session.userId,
        session.role === "super_admin",
      );
    }

    revalidatePath("/invoices");
    revalidatePath("/companies");

    return {
      success: true,
      invoice: JSON.parse(JSON.stringify(invoice)),
    };
  } catch (error) {
    // Handle duplicate invoice number error specifically
    if (
      error.code === 11000 ||
      (error.name === "MongoServerError" && error.code === 11000)
    ) {
      // Duplicate key error - try to regenerate invoice number and retry once
      if (error.keyPattern && error.keyPattern.invoiceNumber) {
        try {
          const session = await getSession();
          if (!session) {
            return { success: false, error: "Unauthorized" };
          }

          // Regenerate invoice number
          const newInvoiceNumber = await generateInvoiceNumber();

          // Recreate invoice data
          const invoiceDate = invoiceData.invoiceDate
            ? new Date(invoiceData.invoiceDate)
            : new Date();

          const carIds = invoiceData.carIds || [];
          const tripNumbersSet = new Set();
          const tripDatesSet = new Set();

          if (carIds.length > 0) {
            const cars = await Car.find({ _id: { $in: carIds } })
              .populate("carrier", "tripNumber name type date")
              .lean();

            cars.forEach((car) => {
              if (car.carrier) {
                if (car.carrier.type === "trip" && car.carrier.tripNumber) {
                  tripNumbersSet.add(car.carrier.tripNumber);
                  if (car.carrier.date) {
                    tripDatesSet.add(new Date(car.carrier.date).toISOString());
                  }
                }
              }
            });
          }

          const retryInvoice = new Invoice({
            invoiceNumber: newInvoiceNumber,
            userId: session.userId,
            senderCompanyName: invoiceData.senderCompanyName,
            senderAddress: invoiceData.senderAddress || "",
            clientCompanyName: invoiceData.clientCompanyName,
            invoiceDate: invoiceDate,
            startDate: new Date(invoiceData.startDate),
            endDate: new Date(invoiceData.endDate),
            carIds: carIds,
            subtotal: invoiceData.subtotal || 0,
            vatPercentage: invoiceData.vatPercentage || 0,
            vatAmount: invoiceData.vatAmount || 0,
            totalAmount: invoiceData.totalAmount || 0,
            descriptions: invoiceData.descriptions || [],
            isActive: invoiceData.isActive || "",
            tripNumbers: Array.from(tripNumbersSet),
            tripDates: Array.from(tripDatesSet).map(
              (dateStr) => new Date(dateStr),
            ),
            payments: [],
            paymentStatus: "unpaid",
          });

          await retryInvoice.save();

          // Add invoice amount to company's due balance
          const companyName = invoiceData.clientCompanyName
            ?.toUpperCase()
            .trim();
          if (companyName) {
            await updateCompanyDueBalance(
              companyName,
              retryInvoice.totalAmount,
              session.userId,
              session.role === "super_admin",
            );
          }

          revalidatePath("/invoices");
          revalidatePath("/companies");

          return {
            success: true,
            invoice: JSON.parse(JSON.stringify(retryInvoice)),
          };
        } catch (retryError) {
          console.error(
            "Error retrying invoice creation with new number:",
            retryError,
          );
          return {
            success: false,
            error:
              "Failed to create invoice: Unable to generate unique invoice number. Please try again.",
          };
        }
      }
    }

    console.error("Error creating invoice:", error);
    return {
      success: false,
      error: error.message || "Failed to create invoice",
    };
  }
}

export async function getInvoices(searchParams = {}) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return {
        invoices: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    const page = parseInt(searchParams.page) || 1;
    const limit = parseInt(searchParams.limit) || 10;
    const skip = (page - 1) * limit;
    const search = searchParams.search || "";
    const company = searchParams.company || "";
    const paymentStatus = searchParams.paymentStatus || "";

    // Build query - users can only see their own invoices
    const query = {};
    if (session.role !== "super_admin") {
      if (mongoose.Types.ObjectId.isValid(session.userId)) {
        query.userId = new mongoose.Types.ObjectId(session.userId);
      }
    }

    // Filter by company (client company name)
    if (company) {
      query.clientCompanyName = {
        $regex: `^${company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      };
    }

    // Filter by payment status
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    // Search across invoice number and sender company (not client company if company filter is set)
    if (search) {
      const searchConditions = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { senderCompanyName: { $regex: search, $options: "i" } },
      ];
      // Only add client company to search if company filter is not set
      if (!company) {
        searchConditions.push({
          clientCompanyName: { $regex: search, $options: "i" },
        });
      }
      query.$or = searchConditions;
    }

    // Get invoices with pagination
    const invoices = await Invoice.find(query)
      .sort({ invoiceDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Populate missing tripIds for old invoices
    for (const invoice of invoices) {
      if (
        invoice.tripNumbers &&
        invoice.tripNumbers.length > 0 &&
        (!invoice.tripIds || invoice.tripIds.length === 0)
      ) {
        // Look up trip IDs from trip numbers
        const tripIds = [];
        for (const tripNumber of invoice.tripNumbers) {
          const carrier = await Carrier.findOne({
            tripNumber: tripNumber,
            type: "trip",
            ...(session.role !== "super_admin"
              ? { userId: new mongoose.Types.ObjectId(session.userId) }
              : {}),
          })
            .select("_id")
            .lean();
          if (carrier) {
            tripIds.push(carrier._id.toString());
          }
        }
        if (tripIds.length > 0) {
          invoice.tripIds = tripIds; // Already strings from toString()
          // Optionally update the invoice in database (async, don't wait)
          Invoice.findByIdAndUpdate(invoice._id, {
            tripIds: tripIds.map((id) => new mongoose.Types.ObjectId(id)),
          }).catch((err) => {
            console.error("Error updating invoice tripIds:", err);
          });
        }
      }
    }

    const total = await Invoice.countDocuments(query);

    // Calculate totals using aggregation (with error handling)
    let totals = { totalAmount: 0, totalPaid: 0, totalBalance: 0 };
    try {
      const totalsResult = await Invoice.aggregate([
        { $match: query },
        {
          $project: {
            totalAmount: { $ifNull: ["$totalAmount", 0] },
            // Calculate total paid (amount - excessAmount) for each payment
            totalPaid: {
              $reduce: {
                input: { $ifNull: ["$payments", []] },
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    {
                      $subtract: [
                        { $ifNull: ["$$this.amount", 0] },
                        { $ifNull: ["$$this.excessAmount", 0] },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$totalAmount" },
            totalPaid: { $sum: "$totalPaid" },
            totalBalance: {
              $sum: {
                $subtract: ["$totalAmount", "$totalPaid"],
              },
            },
          },
        },
      ]);

      if (totalsResult.length > 0) {
        totals = totalsResult[0];
      }
    } catch (aggError) {
      console.error("Error calculating totals (aggregation failed):", aggError);
      // Continue without totals - invoices will still be returned
    }

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
      totals: totals,
    };
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return {
      invoices: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
      error: error.message || "Failed to fetch invoices",
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

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    // Check if user has permission (owner or super admin)
    const invoiceUserId = invoice.userId?.toString();
    const sessionUserId = session.userId?.toString();

    if (session.role !== "super_admin" && invoiceUserId !== sessionUserId) {
      return { success: false, error: "Unauthorized to delete this invoice" };
    }

    // Calculate total paid on this invoice (amount - excessAmount for each payment)
    const totalPaid = (invoice.payments || []).reduce(
      (sum, payment) =>
        sum + ((payment.amount || 0) - (payment.excessAmount || 0)),
      0,
    );

    // Calculate remaining balance (what's still due)
    const remainingBalance = invoice.totalAmount - totalPaid;

    // Update company balances
    const companyName = invoice.clientCompanyName?.toUpperCase().trim();
    if (companyName) {
      // Subtract the remaining balance from dueBalance (reverses invoice creation, accounting for payments)
      // If invoice was overpaid (remainingBalance < 0), we don't subtract anything from dueBalance
      if (remainingBalance > 0) {
        await updateCompanyDueBalance(
          companyName,
          -remainingBalance,
          session.userId,
          session.role === "super_admin",
        );
      }

      // Reverse any excess payments that were added to credit
      const totalExcess = (invoice.payments || []).reduce(
        (sum, payment) => sum + (payment.excessAmount || 0),
        0,
      );
      if (totalExcess > 0) {
        await updateCompanyCredit(companyName, -totalExcess);
      }
    }

    await Invoice.findByIdAndDelete(invoiceId);

    revalidatePath("/invoices");
    revalidatePath("/companies");
    return { success: true, message: "Invoice deleted successfully" };
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return { success: false, error: "Failed to delete invoice" };
  }
}

export async function recordPayment(invoiceId, paymentData) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    // Check if user has permission (owner or super admin)
    const invoiceUserId = invoice.userId?.toString();
    const sessionUserId = session.userId?.toString();

    if (session.role !== "super_admin" && invoiceUserId !== sessionUserId) {
      return {
        success: false,
        error: "Unauthorized to record payment for this invoice",
      };
    }

    // Validate payment amount
    const paymentAmount = parseFloat(paymentData.amount) || 0;
    if (paymentAmount <= 0) {
      return { success: false, error: "Payment amount must be greater than 0" };
    }

    // Calculate total paid so far
    const totalPaid = (invoice.payments || []).reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0,
    );

    // Calculate remaining balance
    const remainingBalance = invoice.totalAmount - totalPaid;
    let excessAmount = 0;

    // If payment exceeds remaining balance, calculate excess
    if (paymentAmount > remainingBalance) {
      excessAmount = paymentAmount - remainingBalance;
    }

    // Store full payment amount in invoice (including excess)
    // The excess will be tracked separately and added to company credit
    const newPayment = {
      amount: paymentAmount, // Full payment amount received
      excessAmount: excessAmount, // Amount that exceeds invoice balance
      paymentDate: paymentData.paymentDate
        ? new Date(paymentData.paymentDate)
        : new Date(),
      paymentMethod: paymentData.paymentMethod || "Cash",
      accountInfo: paymentData.accountInfo || "",
      notes:
        paymentData.notes ||
        (excessAmount > 0
          ? `Full payment: R${paymentAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} | Applied: R${(paymentAmount - excessAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })} | Excess (added to credit): R${excessAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
          : ""),
      recordedBy: session.userId,
    };

    invoice.payments = invoice.payments || [];
    invoice.payments.push(newPayment);

    // Save invoice (pre-save hook will update paymentStatus)
    await invoice.save();

    // Create receipt automatically when payment is recorded
    const paymentIndex = invoice.payments.length - 1; // Index of the newly added payment
    const receiptResult = await createReceipt({
      invoiceId: invoiceId,
      paymentIndex: paymentIndex,
      senderBankDetails: session.bankDetails || "",
    });

    // Update company balances
    const companyName = invoice.clientCompanyName?.toUpperCase().trim();
    if (companyName) {
      // Calculate amount actually applied to invoice (payment - excess)
      const appliedAmount = paymentAmount - excessAmount;

      // Deduct applied amount from company's due balance
      if (appliedAmount > 0) {
        await updateCompanyDueBalance(
          companyName,
          -appliedAmount,
          session.userId,
          session.role === "super_admin",
        );
      }

      // If there's excess payment, add to company credit
      if (excessAmount > 0) {
        await updateCompanyCredit(companyName, excessAmount);
      }
    }

    revalidatePath("/invoices");
    revalidatePath("/companies");

    return {
      success: true,
      invoice: JSON.parse(JSON.stringify(invoice)),
      receipt: receiptResult.success ? receiptResult.receipt : null,
      message:
        excessAmount > 0
          ? `Payment recorded. R${excessAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} added to company credit. Receipt #${receiptResult.receipt?.receiptNumber || "generated"}.`
          : `Payment recorded successfully. Receipt #${receiptResult.receipt?.receiptNumber || "generated"}.`,
    };
  } catch (error) {
    console.error("Error recording payment:", error);
    return { success: false, error: "Failed to record payment" };
  }
}

export async function deletePayment(invoiceId, paymentId) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    // Check if user has permission (owner or super admin)
    const invoiceUserId = invoice.userId?.toString();
    const sessionUserId = session.userId?.toString();

    if (session.role !== "super_admin" && invoiceUserId !== sessionUserId) {
      return {
        success: false,
        error: "Unauthorized to delete payment for this invoice",
      };
    }

    // Find the payment being deleted to check for excess amount
    const paymentToDelete = (invoice.payments || []).find(
      (payment) => payment._id.toString() === paymentId,
    );

    // Update company balances to reverse the payment
    const companyName = invoice.clientCompanyName?.toUpperCase().trim();
    if (companyName && paymentToDelete) {
      // Calculate amount that was applied to invoice (payment - excess)
      const appliedAmount =
        (paymentToDelete.amount || 0) - (paymentToDelete.excessAmount || 0);

      // Add back the applied amount to company's due balance
      if (appliedAmount > 0) {
        await updateCompanyDueBalance(
          companyName,
          appliedAmount,
          session.userId,
          session.role === "super_admin",
        );
      }

      // If payment had excess amount, subtract it from company credit
      if (paymentToDelete.excessAmount > 0) {
        await updateCompanyCredit(companyName, -paymentToDelete.excessAmount);
      }
    }

    // Remove payment
    invoice.payments = (invoice.payments || []).filter(
      (payment) => payment._id.toString() !== paymentId,
    );

    // Save invoice (pre-save hook will update paymentStatus)
    await invoice.save();

    revalidatePath("/invoices");
    revalidatePath("/companies");
    return {
      success: true,
      invoice: JSON.parse(JSON.stringify(invoice)),
      message: "Payment deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting payment:", error);
    return { success: false, error: "Failed to delete payment" };
  }
}

export async function getCompanyBreakdown() {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized", companies: [] };
    }

    // Build query - users can only see their own invoices
    const query = {};
    if (session.role !== "super_admin") {
      if (mongoose.Types.ObjectId.isValid(session.userId)) {
        query.userId = new mongoose.Types.ObjectId(session.userId);
      }
    }

    // Single aggregation pipeline with $facet to get both company breakdown and totals in one roundtrip
    const result = await Invoice.aggregate([
      // Match invoices based on user permissions
      { $match: query },
      // Use $facet to run multiple aggregations in parallel
      {
        $facet: {
          // Company breakdown aggregation
          companies: [
            // Group by client company name and calculate statistics
            {
              $group: {
                _id: "$clientCompanyName",
                totalInvoices: { $sum: 1 },
                totalAmount: { $sum: "$totalAmount" },
                // Calculate total paid from payments array
                totalPaid: {
                  $sum: {
                    $reduce: {
                      input: { $ifNull: ["$payments", []] },
                      initialValue: 0,
                      in: {
                        $add: ["$$value", { $ifNull: ["$$this.amount", 0] }],
                      },
                    },
                  },
                },
                // Count invoices by payment status
                paidInvoices: {
                  $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
                },
                unpaidInvoices: {
                  $sum: {
                    $cond: [{ $eq: ["$paymentStatus", "unpaid"] }, 1, 0],
                  },
                },
                partialInvoices: {
                  $sum: {
                    $cond: [{ $eq: ["$paymentStatus", "partial"] }, 1, 0],
                  },
                },
              },
            },
            // Calculate outstanding balance
            {
              $addFields: {
                outstandingBalance: {
                  $subtract: ["$totalAmount", "$totalPaid"],
                },
              },
            },
            // Rename _id to companyName
            {
              $project: {
                _id: 0,
                companyName: { $ifNull: ["$_id", "Unknown"] },
                totalInvoices: 1,
                paidInvoices: 1,
                unpaidInvoices: 1,
                partialInvoices: 1,
                totalAmount: 1,
                totalPaid: 1,
                outstandingBalance: 1,
              },
            },
            // Sort by outstanding balance (descending)
            { $sort: { outstandingBalance: -1 } },
          ],
          // Totals aggregation (runs in parallel)
          totals: [
            // Group all invoices to calculate totals
            {
              $group: {
                _id: null,
                totalCompanies: { $addToSet: "$clientCompanyName" },
                totalInvoices: { $sum: 1 },
                totalAmount: { $sum: "$totalAmount" },
                // Calculate total paid from payments array
                totalPaid: {
                  $sum: {
                    $reduce: {
                      input: { $ifNull: ["$payments", []] },
                      initialValue: 0,
                      in: {
                        $add: ["$$value", { $ifNull: ["$$this.amount", 0] }],
                      },
                    },
                  },
                },
                // Count invoices by payment status
                paidInvoices: {
                  $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
                },
                unpaidInvoices: {
                  $sum: {
                    $cond: [{ $eq: ["$paymentStatus", "unpaid"] }, 1, 0],
                  },
                },
                partialInvoices: {
                  $sum: {
                    $cond: [{ $eq: ["$paymentStatus", "partial"] }, 1, 0],
                  },
                },
              },
            },
            // Calculate outstanding balance and count unique companies
            {
              $project: {
                _id: 0,
                totalCompanies: { $size: "$totalCompanies" },
                totalInvoices: 1,
                totalAmount: 1,
                totalPaid: 1,
                outstandingBalance: {
                  $subtract: ["$totalAmount", "$totalPaid"],
                },
                paidInvoices: 1,
                unpaidInvoices: 1,
                partialInvoices: 1,
              },
            },
          ],
        },
      },
    ]);

    // Extract results from facet
    const companyBreakdown = result[0]?.companies || [];
    const totalsData = result[0]?.totals[0] || {
      totalCompanies: 0,
      totalInvoices: 0,
      totalAmount: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      paidInvoices: 0,
      unpaidInvoices: 0,
      partialInvoices: 0,
    };

    return {
      success: true,
      companies: JSON.parse(JSON.stringify(companyBreakdown)),
      totals: JSON.parse(JSON.stringify(totalsData)),
    };
  } catch (error) {
    console.error("Error getting company breakdown:", error);
    return {
      success: false,
      error: "Failed to fetch company breakdown",
      companies: [],
      totals: {
        totalCompanies: 0,
        totalInvoices: 0,
        totalAmount: 0,
        totalPaid: 0,
        outstandingBalance: 0,
        paidInvoices: 0,
        unpaidInvoices: 0,
        partialInvoices: 0,
      },
    };
  }
}
