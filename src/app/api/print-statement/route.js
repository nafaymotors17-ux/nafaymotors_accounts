import { NextResponse } from "next/server";
import connectDB from "@/app/lib/dbConnect";
import Transaction from "@/app/lib/models/Transaction";
import Account from "@/app/lib/models/Account";

export async function POST(request) {
  try {
    await connectDB();

    const body = await request.json();
    const { accountSlug, filters } = body;

    // Validate required fields
    if (!accountSlug) {
      return NextResponse.json(
        { error: "Account slug is required" },
        { status: 400 }
      );
    }

    // Find the account to get initial balance and currency
    const account = await Account.findOne({ slug: accountSlug });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Calculate opening balance from transactions before the start date
    let openingBalance = account.initialBalance || 0;
    
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
      
      // Get all transactions before the start date to calculate opening balance
      const priorTransactions = await Transaction.find({
        accountSlug,
        transactionDate: { $lt: startDate },
      })
        .sort({ transactionDate: 1 })
        .lean();

      // Calculate opening balance from prior transactions
      priorTransactions.forEach((transaction) => {
        const credit = transaction.credit || 0;
        const debit = transaction.debit || 0;
        openingBalance = openingBalance + credit - debit;
      });
    }

    // Build query for transactions in the date range
    const query = { accountSlug };

    // Apply date filters
    if (filters.startDate && filters.endDate) {
      const startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      
      query.transactionDate = {
        $gte: startDate,
        $lte: endDate,
      };
    } else if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(filters.startDate);
      endDate.setHours(23, 59, 59, 999);
      
      query.transactionDate = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    // Apply search filter if provided
    if (filters.search && filters.search.trim() !== "") {
      query.$or = [
        { details: { $regex: filters.search, $options: "i" } },
        { destination: { $regex: filters.search, $options: "i" } },
      ];
    }

    // Get transactions sorted by date (oldest first for bank statement)
    const transactions = await Transaction.find(query)
      .sort({ transactionDate: 1, createdAt: 1 })
      .lean();

    // Calculate running balance starting from opening balance
    let currentBalance = openingBalance;
    const transactionsWithCalculatedBalance = transactions.map(
      (transaction) => {
        const credit = transaction.credit || 0;
        const debit = transaction.debit || 0;
        currentBalance = currentBalance + credit - debit;

        return {
          ...transaction,
          _id: transaction._id.toString(),
          calculatedBalance: currentBalance,
        };
      }
    );

    return NextResponse.json({
      success: true,
      transactions: transactionsWithCalculatedBalance,
      openingBalance: openingBalance, // Balance at the start of the period
      closingBalance: currentBalance, // Final balance after all transactions in period
      currentBalance: account.currentBalance ?? 0, // Current account balance (includes all transactions)
      account: {
        title: account.title,
        slug: account.slug,
        currency: account.currency,
        currencySymbol: account.currencySymbol,
        initialBalance: account.initialBalance,
      },
    });
  } catch (error) {
    console.error("Error fetching transactions for print:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions for print" },
      { status: 500 }
    );
  }
}
