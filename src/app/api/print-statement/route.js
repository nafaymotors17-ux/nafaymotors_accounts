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

    // Build query for transactions
    const query = { accountSlug };

    // Apply date filters
    if (filters.startDate && filters.endDate) {
      query.transactionDate = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    // Apply search filter if provided
    if (filters.search && filters.search.trim() !== "") {
      query.$or = [
        { details: { $regex: filters.search, $options: "i" } },
        { destination: { $regex: filters.search, $options: "i" } },
      ];
    }

    // Get transactions
    const transactions = await Transaction.find(query)
      .sort({ transactionDate: 1 })
      .lean();

    // Calculate current balance (starting from initial balance)
    let currentBalance = account.initialBalance || 0;
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
      currentBalance: currentBalance, // Final balance after all transactions
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
