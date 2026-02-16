import { NextResponse } from "next/server";
import connectDB from "@/app/lib/dbConnect";
import Expense from "@/app/lib/models/Expense";
import { getSession } from "@/app/lib/auth/getSession";
import mongoose from "mongoose";

// GET - Get all expenses for a truck
export async function GET(request, { params }) {
  await connectDB();
  try {
    const Truck = (await import("@/app/lib/models/Truck")).default;
    const sessionHeader = request.headers.get("x-session");
    let session = null;
    if (sessionHeader) {
      try {
        session = JSON.parse(sessionHeader);
      } catch (_) {}
    }
    session = await getSession(session);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { truckId } = resolvedParams;
    if (!truckId || !mongoose.Types.ObjectId.isValid(truckId)) {
      return NextResponse.json({ error: "Invalid truck ID" }, { status: 400 });
    }

    // Get truck to check permissions
    const truck = await Truck.findById(truckId);
    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Check permissions
    if (
      session.role !== "super_admin" &&
      truck.userId.toString() !== session.userId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get query parameters for filtering and pagination
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 25;
    const skip = (page - 1) * limit;
    const category = searchParams.get("category");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Convert truckId to ObjectId
    const truckObjectId = new mongoose.Types.ObjectId(truckId);

    // Build query
    const query = { truck: truckObjectId };

    // Filter by category
    if (
      category &&
      ["maintenance", "fuel", "tyre", "others"].includes(category)
    ) {
      query.category = category;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    // Single aggregation: summary, paginated expenses, and count in one round-trip
    const [facetResult] = await Expense.aggregate([
      { $match: query },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: "$category",
                totalAmount: { $sum: "$amount" },
                totalLiters: { $sum: { $ifNull: ["$liters", 0] } },
              },
            },
          ],
          expenses: [
            { $sort: { date: -1, createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: "carriers",
                localField: "carrier",
                foreignField: "_id",
                as: "carrier",
              },
            },
            {
              $unwind: {
                path: "$carrier",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 1,
                truck: 1,
                category: 1,
                amount: 1,
                details: 1,
                liters: 1,
                pricePerLiter: 1,
                tyreNumber: 1,
                tyreInfo: 1,
                meterReading: 1,
                date: 1,
                createdAt: 1,
                updatedAt: 1,
                "carrier._id": 1,
                "carrier.tripNumber": 1,
                "carrier.name": 1,
              },
            },
          ],
          count: [{ $count: "total" }],
        },
      },
    ]);

    const summaryResults = facetResult?.summary || [];
    const expenses = facetResult?.expenses || [];
    const total = facetResult?.count?.[0]?.total ?? 0;

    const summaries = {
      totalExpense: 0,
      totalFuel: 0,
      totalFuelLiters: 0,
      totalMaintenance: 0,
      totalTyre: 0,
      totalOthers: 0,
      byCategory: { maintenance: 0, fuel: 0, tyre: 0, others: 0 },
    };
    summaryResults.forEach((result) => {
      const category = result._id;
      const amount = result.totalAmount || 0;
      summaries.totalExpense += amount;
      summaries.byCategory[category] = amount;
      if (category === "fuel") {
        summaries.totalFuel = amount;
        summaries.totalFuelLiters = result.totalLiters || 0;
      } else if (category === "maintenance") {
        summaries.totalMaintenance = amount;
      } else if (category === "tyre") {
        summaries.totalTyre = amount;
      } else if (category === "others") {
        summaries.totalOthers = amount;
      }
    });

    // Convert ObjectIds to strings for JSON serialization
    const serializedExpenses = (expenses || []).map((expense) => {
      const serialized = {
        _id: expense._id?.toString() || expense._id,
        category: expense.category,
        amount: expense.amount || 0,
        details: expense.details || "",
        liters: expense.liters || null,
        pricePerLiter: expense.pricePerLiter || null,
        tyreNumber: expense.tyreNumber || null,
        tyreInfo: expense.tyreInfo || null,
        meterReading: expense.meterReading || null,
        date: expense.date,
        createdAt: expense.createdAt,
        updatedAt: expense.updatedAt,
        truck: expense.truck?.toString() || expense.truck,
      };

      // Handle carrier if it exists
      if (expense.carrier && expense.carrier._id) {
        serialized.carrier = {
          _id: expense.carrier._id.toString(),
          tripNumber: expense.carrier.tripNumber || null,
          name: expense.carrier.name || null,
        };
      } else {
        serialized.carrier = null;
      }

      return serialized;
    });

    const totalPagesVal = Math.ceil(total / limit) || 1;
    return NextResponse.json({
      expenses: serializedExpenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: totalPagesVal,
        hasNextPage: page < totalPagesVal,
        hasPrevPage: page > 1,
      },
      summaries,
    });
  } catch (error) {
    console.error("Error fetching truck expenses:", error);
    return NextResponse.json(
      { error: "Failed to fetch expenses" },
      { status: 500 },
    );
  }
}

// POST - Create a new expense for a truck
export async function POST(request, { params }) {
  await connectDB();
  try {
    const Truck = (await import("@/app/lib/models/Truck")).default;
    const sessionHeader = request.headers.get("x-session");
    let session = null;
    if (sessionHeader) {
      try {
        session = JSON.parse(sessionHeader);
      } catch (_) {}
    }
    session = await getSession(session);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { truckId } = resolvedParams;
    if (!truckId || !mongoose.Types.ObjectId.isValid(truckId)) {
      return NextResponse.json({ error: "Invalid truck ID" }, { status: 400 });
    }

    // Get truck to check permissions
    const truck = await Truck.findById(truckId);
    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Check permissions
    if (
      session.role !== "super_admin" &&
      truck.userId.toString() !== session.userId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const {
      category,
      amount,
      details,
      liters,
      pricePerLiter,
      date,
      tyreNumber,
      tyreInfo,
      meterReading,
    } = body;

    // Validate required fields
    if (!category) {
      return NextResponse.json(
        { error: "Category is required" },
        { status: 400 },
      );
    }

    // Validate category - allow maintenance, fuel, tyre, and others for trucks
    const validCategories = ["maintenance", "fuel", "tyre", "others"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        {
          error:
            "Invalid category. Only maintenance, fuel, tyre, and others are allowed for trucks.",
        },
        { status: 400 },
      );
    }

    // For fuel expenses, calculate amount from liters and pricePerLiter if provided
    let finalAmount = amount ? parseFloat(amount) : 0;
    if (category === "fuel") {
      if (liters && pricePerLiter) {
        // Calculate amount from liters and price per liter
        finalAmount = parseFloat(liters) * parseFloat(pricePerLiter);
      } else if (amount) {
        // Use provided amount
        finalAmount = parseFloat(amount);
      } else {
        // Neither amount nor liters/pricePerLiter provided
        return NextResponse.json(
          {
            error:
              "For fuel expenses, either provide amount or both liters and pricePerLiter",
          },
          { status: 400 },
        );
      }

      // Validate final amount is positive
      if (!finalAmount || finalAmount <= 0 || isNaN(finalAmount)) {
        return NextResponse.json(
          { error: "Invalid amount. Amount must be greater than 0" },
          { status: 400 },
        );
      }
    } else if (category === "tyre") {
      // For tyre expenses, amount is required
      if (!amount || amount === "" || finalAmount <= 0 || isNaN(finalAmount)) {
        return NextResponse.json(
          {
            error:
              "Amount is required for tyre expenses and must be greater than 0",
          },
          { status: 400 },
        );
      }
    } else if (category === "maintenance") {
      // For maintenance expenses, amount is required
      if (!amount || finalAmount <= 0 || isNaN(finalAmount)) {
        return NextResponse.json(
          { error: "Amount is required for maintenance expenses" },
          { status: 400 },
        );
      }
    } else if (category === "others") {
      // For others expenses, amount is required
      if (!amount || finalAmount <= 0 || isNaN(finalAmount)) {
        return NextResponse.json(
          {
            error:
              "Amount is required for other expenses and must be greater than 0",
          },
          { status: 400 },
        );
      }
    }

    // Convert truckId to ObjectId for the expense
    const truckObjectId = new mongoose.Types.ObjectId(truckId);

    // Create expense
    const expense = new Expense({
      truck: truckObjectId,
      category,
      amount: finalAmount,
      details: details || "",
      liters: category === "fuel" && liters ? parseFloat(liters) : undefined,
      pricePerLiter:
        category === "fuel" && pricePerLiter
          ? parseFloat(pricePerLiter)
          : undefined,
      tyreNumber:
        category === "tyre" && tyreNumber ? tyreNumber.trim() : undefined,
      tyreInfo: category === "tyre" && tyreInfo ? tyreInfo.trim() : undefined,
      meterReading:
        (category === "maintenance" || category === "tyre") && meterReading
          ? parseFloat(meterReading)
          : undefined,
      date: date ? new Date(date) : new Date(),
    });

    await expense.save();

    // If this is a maintenance expense, update truck's last maintenance and current meter reading
    // Use the meter reading from the expense if provided, otherwise use truck's current meter reading
    if (category === "maintenance") {
      const maintenanceKm =
        expense.meterReading || truck.currentMeterReading || 0;
      const maintenanceDate = date ? new Date(date) : new Date();

      // Update truck's last maintenance info and current meter reading
      // Next maintenance will be: lastMaintenanceKm + maintenanceInterval
      await Truck.findByIdAndUpdate(truckId, {
        lastMaintenanceKm: maintenanceKm,
        lastMaintenanceDate: maintenanceDate,
        currentMeterReading: maintenanceKm, // Update current meter reading to the maintenance meter reading
        $push: {
          maintenanceHistory: {
            date: maintenanceDate,
            kmReading: maintenanceKm,
            details: details || "",
            cost: finalAmount,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      expense: JSON.parse(JSON.stringify(expense)),
    });
  } catch (error) {
    console.error("Error creating truck expense:", error);
    console.error("Error stack:", error.stack);
    return NextResponse.json(
      { error: error.message || "Failed to create expense" },
      { status: 500 },
    );
  }
}
