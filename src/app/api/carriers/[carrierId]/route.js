import { NextResponse } from "next/server";
import connectDB from "@/app/lib/dbConnect";
import Carrier from "@/app/lib/models/Carrier";
import Car from "@/app/lib/models/Car";
import Expense from "@/app/lib/models/Expense";
import Driver from "@/app/lib/models/Driver";
import { getSession } from "@/app/lib/auth/getSession";
import mongoose from "mongoose";

// GET - Get a single carrier by ID
export async function GET(request, { params }) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Handle params (may be a promise in Next.js 15+)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { carrierId } = resolvedParams;
    
    if (!carrierId || !mongoose.Types.ObjectId.isValid(carrierId)) {
      return NextResponse.json({ error: "Invalid carrier ID" }, { status: 400 });
    }

    const carrierObjectId = new mongoose.Types.ObjectId(carrierId);

    // Get carrier with populated truck and drivers data using aggregation
    const carriers = await Carrier.aggregate([
      { $match: { _id: carrierObjectId } },
      // Lookup truck
      {
        $lookup: {
          from: "trucks",
          localField: "truck",
          foreignField: "_id",
          as: "truck",
        },
      },
      // Unwind truck (should be single or null)
      {
        $unwind: {
          path: "$truck",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Lookup drivers for truck
      {
        $lookup: {
          from: "drivers",
          localField: "truck.drivers",
          foreignField: "_id",
          as: "truck.drivers",
        },
      },
      // Project truck drivers with only needed fields
      {
        $addFields: {
          "truck.drivers": {
            $map: {
              input: "$truck.drivers",
              as: "driver",
              in: {
                _id: "$$driver._id",
                name: "$$driver.name",
                phone: "$$driver.phone",
                email: "$$driver.email",
              },
            },
          },
        },
      },
      // Format truckData for consistency
      {
        $addFields: {
          truckData: {
            $cond: {
              if: { $ne: ["$truck", null] },
              then: {
                _id: "$truck._id",
                name: "$truck.name",
                number: "$truck.number",
                drivers: "$truck.drivers",
                currentMeterReading: "$truck.currentMeterReading",
              },
              else: null,
            },
          },
        },
      },
      // meterReadingAtTrip and distance are already included in the carrier document
    ]);

    if (!carriers || carriers.length === 0) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }

    const carrier = carriers[0];

    // Check permissions
    if (session.role !== "super_admin" && carrier.userId.toString() !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Build car query
    const carQuery = { carrier: carrierId };
    if (session && session.role !== "super_admin" && session.location) {
      carQuery.location = session.location;
    }

    // Fetch cars and expenses in parallel using Promise.all for faster loading
    // Use select() to only fetch needed fields for better performance
    const [cars, expenses] = await Promise.all([
      Car.find(carQuery)
        .select("_id date stockNo companyName name chassis amount")
        .sort({ date: 1 })
        .lean(),
      Expense.find({ carrier: carrierId })
        .select("_id category amount details liters pricePerLiter date driverRentDriver")
        .populate("driverRentDriver", "name")
        .sort({ date: -1, createdAt: -1 })
        .lean(),
    ]);

    // Calculate totals efficiently
    const totalAmount = cars.reduce((sum, car) => sum + (car.amount || 0), 0);
    const totalExpense = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const profit = totalAmount - totalExpense;

    // Direct JSON serialization is faster than double parsing
    // No cache headers - always fetch fresh data for real-time updates
    return NextResponse.json(
      {
        carrier,
        cars,
        expenses,
        totalAmount,
        totalExpense,
        profit,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching carrier:", error);
    return NextResponse.json(
      { error: "Failed to fetch carrier" },
      { status: 500 }
    );
  }
}
