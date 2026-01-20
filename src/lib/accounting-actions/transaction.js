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

    // Get account info for opening balance calculation (if accountSlug is provided)
    let account = null;
    let openingBalance = 0;
    
    if (accountSlug) {
      account = await Account.findOne({ slug: accountSlug }).lean();
      if (account) {
        openingBalance = account.initialBalance || 0;
        
        // Calculate opening balance from transactions before the start date
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          
          const priorTransactions = await Transaction.find({
            accountSlug,
            transactionDate: { $lt: start },
          })
            .sort({ transactionDate: 1 })
            .lean();

          priorTransactions.forEach((transaction) => {
            const credit = transaction.credit || 0;
            const debit = transaction.debit || 0;
            openingBalance = openingBalance + credit - debit;
          });
        }
      }
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

    /* =======================
       Get all matching transactions first (for balance calculation)
    ======================= */
    const allMatchingTransactions = await Transaction.find(matchStage)
      .sort({ transactionDate: 1, createdAt: 1 }) // Sort oldest first for balance calculation
      .lean();

    // Calculate running balance for all transactions
    let currentBalance = openingBalance;
    const transactionsWithBalance = allMatchingTransactions.map((transaction) => {
      const credit = transaction.credit || 0;
      const debit = transaction.debit || 0;
      currentBalance = currentBalance + credit - debit;

      return {
        ...transaction,
        _id: transaction._id.toString(),
        runningBalance: currentBalance,
      };
    });

    // Reverse to show newest first for display
    transactionsWithBalance.reverse();

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedTransactions = transactionsWithBalance.slice(skip, skip + limit);

    // Get account info for each transaction if not already included
    let transactionsWithAccountInfo;
    
    if (account) {
      // Single account - use cached account info
      transactionsWithAccountInfo = paginatedTransactions.map((transaction) => ({
        ...transaction,
        account: {
          title: account.title,
          slug: account.slug,
          currency: account.currency,
          currencySymbol: account.currencySymbol,
        },
      }));
    } else {
      // Multiple accounts - batch lookup
      const uniqueAccountIds = [
        ...new Set(
          paginatedTransactions.map((t) => t.accountId?.toString()).filter(Boolean)
        ),
      ];
      
      const accountsMap = new Map();
      if (uniqueAccountIds.length > 0) {
        const accounts = await Account.find({
          _id: { $in: uniqueAccountIds.map((id) => new mongoose.Types.ObjectId(id)) },
        }).lean();
        
        accounts.forEach((acc) => {
          accountsMap.set(acc._id.toString(), {
            title: acc.title,
            slug: acc.slug,
            currency: acc.currency,
            currencySymbol: acc.currencySymbol,
          });
        });
      }
      
      transactionsWithAccountInfo = paginatedTransactions.map((transaction) => ({
        ...transaction,
        account: transaction.accountId
          ? accountsMap.get(transaction.accountId.toString()) || null
          : null,
      }));
    }

    const total = transactionsWithBalance.length;

    return {
      transactions: transactionsWithAccountInfo,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      openingBalance: openingBalance,
    };
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return {
      transactions: [],
      total: 0,
      page: 1,
      totalPages: 0,
      openingBalance: 0,
    };
  }
}

export async function getAccountTransactions(accountSlug, filters = {}) {
  return getAllTransactions({ ...filters, accountSlug });
}

export async function getTransactionsForPrint(filters = {}) {
  await connectDB();

  try {
    const { startDate, endDate, search, type, accountSlug } = filters;

    const matchStage = { accountSlug };

    // Date Filter
    if (startDate || endDate) {
      const dateQuery = {};

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateQuery.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.$lte = end;
      }

      matchStage.transactionDate = dateQuery;
    }

    // Type Filter
    if (type && type !== "all") {
      if (type === "credit") {
        matchStage.credit = { $gt: 0 };
      } else if (type === "debit") {
        matchStage.debit = { $gt: 0 };
      }
    }

    // Search Filter
    if (search) {
      matchStage.details = { $regex: search, $options: "i" };
    }

    // Get transactions sorted by date
    const transactions = await Transaction.find(matchStage)
      .sort({ transactionDate: 1 })
      .lean();

    return {
      success: true,
      transactions,
      count: transactions.length,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching print data:", error);
    return {
      success: false,
      error: "Failed to fetch data for printing",
      transactions: [],
      count: 0,
    };
  }
}
