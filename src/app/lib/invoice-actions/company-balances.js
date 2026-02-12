"use server";

import { revalidatePath } from "next/cache";
import connectDB from "../dbConnect";
import Invoice from "../models/Invoice";
import Company from "../models/Company";
import { getSession } from "../auth/getSession";

/**
 * Get company balance information
 * Uses stored creditBalance and dueBalance from Company model
 */
export async function getCompanyBalances() {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    // Get all companies with their stored balances
    const companyQuery = {};
    if (session.role !== "super_admin") {
      companyQuery.userId = session.userId;
    }

    const companies = await Company.find(companyQuery).lean();

    // Build company balances array from Company model
    const companyBalances = companies.map((company) => {
      const companyName = company.name?.toUpperCase().trim();
      return {
        companyName: companyName || "UNKNOWN",
        creditBalance: company.creditBalance || 0,
        totalDue: company.dueBalance || 0,
        _id: company._id?.toString() || company._id,
        createdAt: company.createdAt || null,
      };
    });

    // Sort by company name
    const balancesArray = companyBalances.sort((a, b) =>
      a.companyName.localeCompare(b.companyName)
    );

    return {
      success: true,
      balances: JSON.parse(JSON.stringify(balancesArray)),
    };
  } catch (error) {
    console.error("Error getting company balances:", error);
    return { success: false, error: "Failed to get company balances" };
  }
}

/**
 * Get balance information for a specific company
 */
export async function getCompanyBalance(companyName) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized", creditBalance: 0, dueBalance: 0 };
    }

    const normalizedName = companyName?.toUpperCase().trim();
    if (!normalizedName) {
      return { success: true, creditBalance: 0, dueBalance: 0 };
    }

    // Find company globally by name (company names are globally unique)
    const company = await Company.findOne({ name: normalizedName }).lean();
    
    if (company) {
      return {
        success: true,
        creditBalance: company.creditBalance || 0,
        dueBalance: company.dueBalance || 0,
      };
    }

    return { success: true, creditBalance: 0, dueBalance: 0 };
  } catch (error) {
    console.error("Error getting company balance:", error);
    return { success: false, error: "Failed to get company balance", creditBalance: 0, dueBalance: 0 };
  }
}

/**
 * Get credit balance for a specific company
 */
export async function getCompanyCredit(companyName) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized", credit: 0 };
    }

    const normalizedName = companyName?.toUpperCase().trim();
    if (!normalizedName) {
      return { success: true, credit: 0 };
    }

    // Build query
    const query = { clientCompanyName: normalizedName };
    if (session.role !== "super_admin") {
      query.userId = session.userId;
    }

    // Calculate credit from overpaid invoices using aggregation (database-level)
    const overpaidResult = await Invoice.aggregate([
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
                      { $ifNull: ["$$this.excessAmount", 0] }
                    ]
                  }
                ]
              }
            }
          }
        }
      },
      {
        $addFields: {
          remaining: {
            $subtract: ["$totalAmount", "$totalPaid"]
          }
        }
      },
      {
        $match: {
          remaining: { $lt: 0 } // Only overpaid invoices
        }
      },
      {
        $group: {
          _id: null,
          totalCredit: {
            $sum: { $abs: "$remaining" }
          }
        }
      }
    ]);

    let creditBalance = overpaidResult.length > 0 ? (overpaidResult[0].totalCredit || 0) : 0;

    // Also check Company model for stored credit (company names are globally unique)
    const company = await Company.findOne({ name: normalizedName }).lean();
    if (company && company.creditBalance) {
      creditBalance += company.creditBalance;
    }

    return { success: true, credit: creditBalance };
  } catch (error) {
    console.error("Error getting company credit:", error);
    return { success: false, error: "Failed to get company credit", credit: 0 };
  }
}

/**
 * Update company credit balance in Company model (adds/subtracts)
 */
export async function updateCompanyCredit(companyName, creditAmount) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const normalizedName = companyName?.toUpperCase().trim();
    if (!normalizedName) {
      return { success: false, error: "Company name is required" };
    }

    // Find company globally by name (company names are globally unique)
    let company = await Company.findOne({ name: normalizedName });

    if (!company) {
      // Create company if it doesn't exist
      company = new Company({
        name: normalizedName,
        userId: session.userId,
        creditBalance: creditAmount,
      });
    } else {
      // Update credit balance (add/subtract)
      company.creditBalance = (company.creditBalance || 0) + creditAmount;
    }

    await company.save();
    revalidatePath("/companies");
    revalidatePath("/invoices");

    return { success: true };
  } catch (error) {
    console.error("Error updating company credit:", error);
    return { success: false, error: "Failed to update company credit" };
  }
}

/**
 * Set company credit balance to a specific amount
 */
export async function setCompanyCredit(companyName, newCreditBalance) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const normalizedName = companyName?.toUpperCase().trim();
    if (!normalizedName) {
      return { success: false, error: "Company name is required" };
    }

    // Find company globally by name (company names are globally unique)
    let company = await Company.findOne({ name: normalizedName });

    if (!company) {
      // Create company if it doesn't exist
      company = new Company({
        name: normalizedName,
        userId: session.userId,
        creditBalance: newCreditBalance,
      });
    } else {
      // Set credit balance to new value
      company.creditBalance = newCreditBalance;
    }

    await company.save();
    revalidatePath("/companies");
    revalidatePath("/invoices");

    return { success: true };
  } catch (error) {
    console.error("Error setting company credit:", error);
    return { success: false, error: "Failed to set company credit" };
  }
}

/**
 * Update company due balance in Company model (adds/subtracts)
 * This is used internally when invoices are created/deleted or payments are made
 */
export async function updateCompanyDueBalance(companyName, dueAmount, sessionUserId, isSuperAdmin = false) {
  await connectDB();
  try {
    const normalizedName = companyName?.toUpperCase().trim();
    if (!normalizedName) {
      return { success: false, error: "Company name is required" };
    }

    // Find company globally by name (company names are globally unique)
    let company = await Company.findOne({ name: normalizedName });

    if (!company) {
      // Create company if it doesn't exist
      company = new Company({
        name: normalizedName,
        userId: sessionUserId,
        dueBalance: dueAmount,
      });
    } else {
      // Update due balance (add/subtract)
      company.dueBalance = (company.dueBalance || 0) + dueAmount;
      // Ensure dueBalance doesn't go negative
      if (company.dueBalance < 0) {
        company.dueBalance = 0;
      }
    }

    await company.save();
    revalidatePath("/companies");
    revalidatePath("/invoices");

    return { success: true };
  } catch (error) {
    console.error("Error updating company due balance:", error);
    return { success: false, error: "Failed to update company due balance" };
  }
}