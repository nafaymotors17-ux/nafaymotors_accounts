"use server";

import mongoose from "mongoose";
import connectDB from "../dbConnect";
import Carrier from "../models/Carrier";
import Car from "../models/Car";
import { getAccountsCount } from "../accounting-actions/accounts";
import { getSession } from "../auth/getSession";

export async function getDashboardData() {
  try {
    await connectDB();
    const session = await getSession();
    
    if (!session) {
      return {
        error: "Unauthorized",
        session: null,
        totalAccounts: 0,
        carriers: [],
        stats: {
          totalTrips: 0,
          activeTrips: 0,
          inactiveTrips: 0,
          totalCars: 0,
          totalAmount: 0,
        },
      };
    }

    // Build carrier query based on user role
    const carrierQuery = {};
    if (session.role !== "super_admin" && session.userId) {
      if (mongoose.Types.ObjectId.isValid(session.userId)) {
        carrierQuery.userId = new mongoose.Types.ObjectId(session.userId);
      }
    }

    // Build car query based on user role
    const carQuery = {};
    if (session.role !== "super_admin" && session.userId) {
      if (mongoose.Types.ObjectId.isValid(session.userId)) {
        carQuery.userId = new mongoose.Types.ObjectId(session.userId);
      }
    }

    // Run all count queries in parallel for maximum performance
    const [
      totalTrips,
      activeTrips,
      inactiveTrips,
      carsStats,
      recentCarriers,
      totalAccounts,
    ] = await Promise.all([
      // Total trips count
      Carrier.countDocuments(carrierQuery),
      
      // Active trips count (isActive=true OR isActive is undefined/null)
      Carrier.countDocuments({
        ...carrierQuery,
        $or: [
          { isActive: true },
          { isActive: { $exists: false } },
          { isActive: null }
        ]
      }),
      
      // Inactive trips count
      Carrier.countDocuments({
        ...carrierQuery,
        isActive: false
      }),
      
      // Cars count and total amount in one aggregation
      Car.aggregate([
        { $match: carQuery },
        {
          $group: {
            _id: null,
            totalCars: { $sum: 1 },
            totalAmount: { $sum: "$amount" }
          }
        }
      ]),
      
      // Recent 5 carriers with minimal data (only what's needed for display)
      Carrier.aggregate([
        { $match: carrierQuery },
        {
          $lookup: {
            from: "cars",
            localField: "_id",
            foreignField: "carrier",
            as: "cars",
          },
        },
        {
          $addFields: {
            carCount: { $size: "$cars" },
            totalAmount: { $sum: "$cars.amount" },
          },
        },
        { $sort: { date: -1, createdAt: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 1,
            tripNumber: 1,
            name: 1,
            type: 1,
            carCount: 1,
            totalAmount: 1,
          },
        },
      ]),
      
      // Accounts count (only if super admin)
      session.role === "super_admin" ? getAccountsCount() : Promise.resolve(0),
    ]);

    // Extract cars stats
    const carsStatsResult = carsStats[0] || { totalCars: 0, totalAmount: 0 };
    const totalCars = carsStatsResult.totalCars || 0;
    const totalAmount = carsStatsResult.totalAmount || 0;

    // Format recent carriers
    const carriers = recentCarriers.map((carrier) => ({
      ...carrier,
      _id: carrier._id.toString(),
    }));

    return {
      session: {
        userId: session.userId,
        username: session.username,
        role: session.role,
      },
      totalAccounts: totalAccounts || 0,
      carriers,
      stats: {
        totalTrips,
        activeTrips,
        inactiveTrips,
        totalCars,
        totalAmount,
      },
    };
  } catch (error) {
    return {
      error: "Failed to fetch dashboard data",
      session: null,
      totalAccounts: 0,
      carriers: [],
      stats: {
        totalTrips: 0,
        activeTrips: 0,
        inactiveTrips: 0,
        totalCars: 0,
        totalAmount: 0,
      },
    };
  }
}
