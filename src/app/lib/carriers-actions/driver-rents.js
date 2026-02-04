"use server";

import mongoose from "mongoose";
import connectDB from "@/app/lib/dbConnect";
import Expense from "@/app/lib/models/Expense";
import Carrier from "@/app/lib/models/Carrier";
import Truck from "@/app/lib/models/Truck";
import Driver from "@/app/lib/models/Driver";
import { getSession } from "@/app/lib/auth/getSession";

export async function getDriverRentPayments(driverId, page = 1, limit = 10) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    // Validate driverId
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return { error: "Invalid driver ID" };
    }

    const driverObjectId = new mongoose.Types.ObjectId(driverId);

    // Find all driver_rent expenses:
    // Only show expenses directly assigned to this driver (driver field)
    // Exclude original trip expenses (those with carrier + driverRentDriver) to avoid duplicates
    // We only want to show the synced driver expenses, not the original trip expenses
    const query = {
      category: "driver_rent",
      driver: driverObjectId, // Only expenses directly assigned to driver
      // Exclude expenses that are original trip expenses (have carrier but are synced)
      // We want synced expenses (have driver field) but not original trip expenses
    };

    // Apply user filter - only show expenses for drivers owned by the user
    // Since we're only showing synced driver expenses (with driver field),
    // we need to check if the driver belongs to the user
    if (session.role !== "super_admin") {
      // Verify the driver belongs to the user
      const driver = await Driver.findById(driverId);
      const driverBelongsToUser = driver && driver.userId.toString() === session.userId;
      
      if (!driverBelongsToUser) {
        // Driver doesn't belong to user, return empty results
        return {
          payments: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
          totalAmount: 0,
        };
      }
      // If driver belongs to user, query already filters by driver, so it's fine
    }

    // Get total count and total amount for all matching expenses
    const [total, totalAmountResult] = await Promise.all([
      Expense.countDocuments(query),
      Expense.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" }
          }
        }
      ])
    ]);

    const totalAmount = totalAmountResult.length > 0 ? totalAmountResult[0].totalAmount : 0;

    const expenses = await Expense.find(query)
      .populate({
        path: "syncedFromExpense",
        select: "carrier",
        populate: {
          path: "carrier",
          select: "tripNumber name date truck",
          populate: {
            path: "truck",
            select: "name number",
          },
        },
      })
      .populate("driver", "name")
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Serialize the data
    const payments = expenses.map(expense => {
      // Get carrier from syncedFromExpense if it exists, otherwise from direct carrier field
      const carrier = expense.syncedFromExpense?.carrier || expense.carrier;
      
      return {
        _id: expense._id.toString(),
        amount: expense.amount,
        date: expense.date,
        details: expense.details || "",
        driver: expense.driver ? {
          _id: expense.driver._id.toString(),
          name: expense.driver.name,
        } : null,
        trip: carrier ? {
          _id: carrier._id.toString(),
          tripNumber: carrier.tripNumber || carrier.name || "N/A",
          date: carrier.date,
          truckName: carrier.truck?.name || "",
          truckNumber: carrier.truck?.number || "",
        } : null,
      };
    });

    return {
      payments: JSON.parse(JSON.stringify(payments)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      totalAmount,
    };
  } catch (error) {
    console.error("Error fetching driver rent payments:", error);
    return { error: "Failed to fetch driver rent payments" };
  }
}
