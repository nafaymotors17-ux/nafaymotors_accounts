"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import connectDB from "@/lib/dbConnect";
import Account from "@/lib/models/Account";
export async function getAccounts(searchParams = {}) {
  await connectDB();

  const search =
    typeof searchParams === "string" ? searchParams : searchParams?.search;
  const currency = searchParams?.currency;
  const status = searchParams?.status;

  const query = {};

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } },
    ];
  }

  if (currency && currency !== "all") {
    query.currency = currency;
  }

  try {
    const accounts = await Account.find(query).sort({ createdAt: -1 }).lean();

    return { accounts: JSON.parse(JSON.stringify(accounts)) };
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return { accounts: [] };
  }
}
export async function createAccount(formData) {
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
