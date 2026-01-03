"use server";

import { revalidatePath } from "next/cache";
import connectDB from "@/lib/dbConnect";
import Account from "@/lib/models/Account";
import Transaction from "@/lib/models/Transaction";

import mongoose from "mongoose";

export async function createTransaction(formData) {
  await connectDB();
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const accountId = formData.get("accountId");
    const type = formData.get("type");
    const amount = Number(formData.get("amount"));
    const details = formData.get("details");
    const destination = formData.get("destination")?.trim() || null;
    const debitType = formData.get("debitType");
    const rateOfExchange = formData.get("rateOfExchange")
      ? Number(formData.get("rateOfExchange"))
      : null;

    const transactionDate = formData.get("transactionDate")
      ? new Date(formData.get("transactionDate"))
      : new Date();

    /* =====================
       Validation
    ===================== */
    if (!accountId || !type || !amount || !details) {
      return { error: "Account, type, amount, and details are required" };
    }

    if (type === "debit" && debitType === "transfer" && !destination) {
      return { error: "Destination is required for transfers" };
    }

    /* =====================
       Get Account (locked)
    ===================== */
    const account = await Account.findById(accountId).session(session);
    if (!account) {
      return { error: "Account not found" };
    }

    let credit = 0;
    let debit = 0;

    if (type === "credit") credit = amount;
    if (type === "debit") debit = amount;

    const newBalance = account.currentBalance + credit - debit;

    /* =====================
       Update Balance (atomic)
    ===================== */
    account.currentBalance = newBalance;
    await account.save({ session });

    /* =====================
       Create Transaction
    ===================== */
    await Transaction.create(
      [
        {
          accountId,
          accountSlug: account.slug,
          credit,
          debit,
          currency: account.currency,
          details,
          destination:
            type === "debit" && debitType === "transfer" ? destination : null,
          rateOfExchange,
          transactionDate,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    revalidatePath("/");

    return {
      success: true,
      message: "Transaction recorded successfully",
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error creating transaction:", error);
    return { error: "Failed to create transaction" };
  }
}

export async function getAllTransactions(filters = {}) {
  await connectDB();

  try {
    const {
      startDate,
      endDate,
      search,
      type,
      accountSlug,
      accountIds,
      page = 1,
      limit = 50,
    } = filters;

    const matchStage = {};

    /* =======================
       Account Filter
    ======================= */
    if (accountSlug) {
      matchStage.accountSlug = accountSlug;
    } else if (Array.isArray(accountIds) && accountIds.length > 0) {
      matchStage.accountId = {
        $in: accountIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    /* =======================
       Date Filter (Exact / Range)
    ======================= */
    if (startDate || endDate) {
      const dateQuery = {};

      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        dateQuery.$gte = start;
        dateQuery.$lte = end;
      } else if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(startDate);
        end.setHours(23, 59, 59, 999);

        dateQuery.$gte = start;
        dateQuery.$lte = end;
      }

      matchStage.transactionDate = dateQuery;
    }

    /* =======================
       Type Filter
    ======================= */
    if (type === "credit") {
      matchStage.credit = { $gt: 0 };
    } else if (type === "debit") {
      matchStage.debit = { $gt: 0 };
    }

    /* =======================
       Search Filter
    ======================= */
    if (search) {
      matchStage.details = { $regex: search, $options: "i" };
    }

    const skip = (page - 1) * limit;

    /* =======================
       Aggregation Pipeline
    ======================= */
    const pipeline = [
      { $match: matchStage },

      { $sort: { transactionDate: -1, createdAt: -1 } },

      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },

            {
              $lookup: {
                from: "accounts",
                localField: "accountId",
                foreignField: "_id",
                as: "account",
              },
            },
            { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },

            {
              $project: {
                _id: 1,
                transactionDate: 1,
                credit: 1,
                debit: 1,
                details: 1,
                createdAt: 1,
                account: {
                  title: "$account.title",
                  slug: "$account.slug",
                  currency: "$account.currency",
                  currencySymbol: "$account.currencySymbol",
                },
              },
            },
          ],

          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const [result] = await Transaction.aggregate(pipeline);

    const transactions = result.data || [];
    const total = result.totalCount[0]?.count || 0;

    return {
      transactions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return {
      transactions: [],
      total: 0,
      page: 1,
      totalPages: 0,
    };
  }
}

export async function getAccountTransactions(accountSlug, filters = {}) {
  return getAllTransactions({ ...filters, accountSlug });
}
