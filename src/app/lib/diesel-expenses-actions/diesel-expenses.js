"use server";

import connectDB from "@/app/lib/dbConnect";
import { getSession } from "@/app/lib/auth/getSession";
import Expense from "@/app/lib/models/Expense";
import mongoose from "mongoose";

/**
 * Get diesel (fuel) expenses aggregated by truck for the current user.
 * Only returns data for trucks owned by the user (or filtered by userId for super_admin).
 * @param {Object} options - { startDate, endDate, truckIds[], userId (super_admin only) }
 * @param {Object} sessionFromClient - Session from client (e.g. from UserContext) for cookie-less auth
 * @returns {Object} { byTruck: [...], overall: { totalLiters, totalAmount, expenseCount }, trucks: [...] }
 */
export async function getDieselExpensesByTrucks(options = {}, sessionFromClient = null) {
  await connectDB();
  try {
    const session = sessionFromClient || (await getSession());
    if (!session?.userId) {
      return { byTruck: [], overall: { totalLiters: 0, totalAmount: 0, expenseCount: 0 }, trucks: [] };
    }

    const Truck = (await import("@/app/lib/models/Truck")).default;
    const { startDate, endDate, truckIds, userId: filterUserId } = options;

    // Resolve which trucks the user can see
    const truckQuery = {};
    if (filterUserId && session.role === "super_admin" && mongoose.Types.ObjectId.isValid(filterUserId)) {
      truckQuery.userId = new mongoose.Types.ObjectId(filterUserId);
    } else {
      truckQuery.userId = new mongoose.Types.ObjectId(session.userId);
    }

    const trucks = await Truck.find(truckQuery)
      .select("_id name number")
      .sort({ name: 1 })
      .lean();

    const allowedTruckIds = trucks.map((t) => t._id);
    if (allowedTruckIds.length === 0) {
      return {
        byTruck: [],
        overall: { totalLiters: 0, totalAmount: 0, expenseCount: 0 },
        trucks: trucks.map((t) => ({
          _id: t._id.toString(),
          name: t.name,
          number: t.number || null,
        })),
      };
    }

    // Optional filter: only specific trucks
    let targetTruckIds = allowedTruckIds;
    if (truckIds && Array.isArray(truckIds) && truckIds.length > 0) {
      const valid = truckIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      targetTruckIds = valid.filter((id) => allowedTruckIds.some((a) => a.equals(id)));
    }

    const expenseMatch = {
      truck: { $in: targetTruckIds },
      category: "fuel",
    };

    if (startDate || endDate) {
      expenseMatch.date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        expenseMatch.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        expenseMatch.date.$lte = end;
      }
    }

    // Aggregate: group by truck, get expenses and totals
    const byTruckAgg = await Expense.aggregate([
      { $match: expenseMatch },
      { $sort: { date: -1, createdAt: -1 } },
      {
        $group: {
          _id: "$truck",
          expenses: {
            $push: {
              _id: "$_id",
              date: "$date",
              amount: "$amount",
              liters: "$liters",
              pricePerLiter: "$pricePerLiter",
              details: "$details",
              syncedFromExpense: "$syncedFromExpense",
            },
          },
          totalLiters: { $sum: { $ifNull: ["$liters", 0] } },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "trucks",
          localField: "_id",
          foreignField: "_id",
          as: "truckDoc",
        },
      },
      { $unwind: { path: "$truckDoc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          truckId: "$_id",
          truckName: "$truckDoc.name",
          truckNumber: "$truckDoc.number",
          expenses: 1,
          totalLiters: 1,
          totalAmount: 1,
          count: 1,
        },
      },
    ]);

    // Fix avgPricePerLiter in projection (we grouped so liters sum is in totalLiters)
    const byTruck = byTruckAgg.map((row) => {
      const totalL = row.totalLiters || 0;
      const totalA = row.totalAmount || 0;
      const expenses = (row.expenses || []).map((e) => ({
        _id: e._id?.toString(),
        date: e.date,
        amount: e.amount,
        liters: e.liters,
        pricePerLiter: e.pricePerLiter,
        details: e.details || "",
      }));
      return {
        truckId: row.truckId?.toString(),
        truckName: row.truckName || "—",
        truckNumber: row.truckNumber || null,
        expenses,
        totalLiters: totalL,
        totalAmount: totalA,
        expenseCount: row.count || 0,
        avgPricePerLiter: totalL > 0 ? totalA / totalL : null,
      };
    });

    // Overall totals
    const overall = byTruck.reduce(
      (acc, t) => ({
        totalLiters: acc.totalLiters + (t.totalLiters || 0),
        totalAmount: acc.totalAmount + (t.totalAmount || 0),
        expenseCount: acc.expenseCount + (t.expenseCount || 0),
      }),
      { totalLiters: 0, totalAmount: 0, expenseCount: 0 }
    );

    const trucksList = trucks.map((t) => ({
      _id: t._id.toString(),
      name: t.name,
      number: t.number || null,
    }));

    return {
      byTruck,
      overall,
      trucks: trucksList,
    };
  } catch (error) {
    console.error("Error fetching diesel expenses:", error);
    return {
      byTruck: [],
      overall: { totalLiters: 0, totalAmount: 0, expenseCount: 0 },
      trucks: [],
    };
  }
}
