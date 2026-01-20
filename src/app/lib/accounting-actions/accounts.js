"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import connectDB from "@/app/lib/dbConnect";
import Account from "@/app/lib/models/Account";
import { requireSuperAdmin } from "@/app/lib/auth/getSession";

export async function getAccounts(searchParams = {}) {
  try {
    // Only super admin can access accounting
    await requireSuperAdmin();
  } catch (error) {
    console.error("[getAccounts] Access denied:", error.message);
    return {
      accounts: [],
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
  
  await connectDB();

  const page = parseInt(searchParams.page) || 1;
  const limit = parseInt(searchParams.limit) || 10;
  const search = searchParams.search || "";
  const currency = searchParams.currency || "";

  const query = {};

  // Search filter
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } },
    ];
  }

  // Currency filter
  if (currency && currency !== "all") {
    query.currency = currency;
  }

  try {
    // Get total count for pagination
    const total = await Account.countDocuments(query);

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    // Get paginated accounts
    const accounts = await Account.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      accounts: JSON.parse(JSON.stringify(accounts)),
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
    console.error("Error fetching accounts:", error);
    return {
      accounts: [],
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
}
export async function getAccountsCount() {
  try {
    // Only super admin can access accounting
    await requireSuperAdmin();
    await connectDB();
    const totalAccounts = await Account.countDocuments();
    return totalAccounts;
  } catch (error) {
    // If not super admin or other error, return 0
    console.error("[getAccountsCount] Error:", error.message);
    return 0;
  }
}
export async function createAccount(formData) {
  try {
    // Only super admin can create accounts
    await requireSuperAdmin();
  } catch (error) {
    console.error("[createAccount] Access denied:", error.message);
    return { error: "Access denied: Super admin required" };
  }
  
  await connectDB();

  try {
    const title = formData.get("title");
    const slug = formData.get("slug");
    const initialBalance = parseFloat(formData.get("initialBalance"));
    const currency = formData.get("currency");
    const currencySymbol = formData.get("currencySymbol");

    // Validate input
    if (!title || !slug || !currency || !currencySymbol) {
      return { error: "All fields are required" };
    }

    if (isNaN(initialBalance)) {
      return { error: "Initial balance must be a valid number" };
    }

    // Check if account with same slug exists
    const existingAccount = await Account.findOne({
      slug: slug.toLowerCase().trim(),
    });
    if (existingAccount) {
      return { error: "Account with this slug already exists" };
    }

    // Create new account
    const account = new Account({
      title: title.trim(),
      slug: slug.toLowerCase().trim(),
      initialBalance: parseFloat(initialBalance) || 0,
      currentBalance: parseFloat(initialBalance) || 0,
      currency: currency.trim(),
      currencySymbol: currencySymbol.trim(),
    });

    await account.save();

    revalidatePath("/");
    return { success: true, message: "Account created successfully" };
  } catch (error) {
    console.error("Error creating account:", error);
    // Return more specific error message
    if (error.code === 11000) {
      return { error: "Account with this slug already exists" };
    }
    if (error.message) {
      return { error: error.message };
    }
    return {
      error: "Failed to create account. Please check all fields and try again.",
    };
  }
}
