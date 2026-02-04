import { NextResponse } from "next/server";
import connectDB from "@/app/lib/dbConnect";
import Expense from "@/app/lib/models/Expense";
import Carrier from "@/app/lib/models/Carrier";
import Truck from "@/app/lib/models/Truck";
import { getSession } from "@/app/lib/auth/getSession";
import mongoose from "mongoose";

// GET - Get all expenses for a carrier
export async function GET(request, { params }) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { carrierId } = resolvedParams;
    if (!carrierId || !mongoose.Types.ObjectId.isValid(carrierId)) {
      return NextResponse.json({ error: "Invalid carrier ID" }, { status: 400 });
    }

    // Get carrier to check permissions
    const carrier = await Carrier.findById(carrierId);
    if (!carrier) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }

    // Check permissions
    if (session.role !== "super_admin" && carrier.userId.toString() !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get all expenses for this carrier
    const expenses = await Expense.find({ carrier: carrierId })
      .populate('driverRentDriver', 'name')
      .sort({ date: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      expenses: JSON.parse(JSON.stringify(expenses)),
    });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json(
      { error: "Failed to fetch expenses" },
      { status: 500 }
    );
  }
}

// POST - Create a new expense
export async function POST(request, { params }) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { carrierId } = resolvedParams;
    if (!carrierId || !mongoose.Types.ObjectId.isValid(carrierId)) {
      return NextResponse.json({ error: "Invalid carrier ID" }, { status: 400 });
    }

    // Get carrier to check permissions
    const carrier = await Carrier.findById(carrierId);
    if (!carrier) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }

    // Check permissions
    if (session.role !== "super_admin" && carrier.userId.toString() !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { category, amount, details, liters, pricePerLiter, date, driver, meterReading } = body;

    // Validate required fields
    if (!category) {
      return NextResponse.json(
        { error: "Category is required" },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = ["fuel", "driver_rent", "taxes", "tool_taxes", "on_road", "maintenance", "tyre", "others"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    // For fuel expenses, calculate amount from liters and pricePerLiter if provided
    let finalAmount = amount ? parseFloat(amount) : 0;
    if (category === "fuel") {
      if (liters && pricePerLiter) {
        finalAmount = parseFloat(liters) * parseFloat(pricePerLiter);
      } else if (!amount) {
        return NextResponse.json(
          { error: "For fuel expenses, either provide amount or both liters and pricePerLiter" },
          { status: 400 }
        );
      }
    } else if (!amount) {
      return NextResponse.json(
        { error: "Amount is required" },
        { status: 400 }
      );
    }

    // Validate driver for driver_rent category
    if (category === "driver_rent" && !driver) {
      return NextResponse.json(
        { error: "Driver is required for driver rent expenses" },
        { status: 400 }
      );
    }

    // Validate driver ID if provided
    if (driver && !mongoose.Types.ObjectId.isValid(driver)) {
      return NextResponse.json(
        { error: "Invalid driver ID" },
        { status: 400 }
      );
    }

    // Create expense
    const expense = new Expense({
      carrier: carrierId,
      category,
      amount: finalAmount,
      details: details || "",
      liters: category === "fuel" && liters ? parseFloat(liters) : undefined,
      pricePerLiter: category === "fuel" && pricePerLiter ? parseFloat(pricePerLiter) : undefined,
      driverRentDriver: category === "driver_rent" && driver ? new mongoose.Types.ObjectId(driver) : undefined,
      meterReading: category === "maintenance" && meterReading ? parseFloat(meterReading) : undefined,
      date: date ? new Date(date) : new Date(),
    });

    await expense.save();

    // If this is a fuel expense and the carrier has a truck, also create synced expense for the truck
    if (category === "fuel" && carrier.truck) {
      const truckExpense = new Expense({
        truck: carrier.truck,
        category: "fuel",
        amount: finalAmount,
        details: (details || "").trim(),
        liters: liters ? parseFloat(liters) : undefined,
        pricePerLiter: pricePerLiter ? parseFloat(pricePerLiter) : undefined,
        date: date ? new Date(date) : new Date(),
        syncedFromExpense: expense._id, // Track the original expense
      });
      await truckExpense.save();
    }

    // If this is a driver_rent expense, also create synced expense for the driver
    if (category === "driver_rent" && driver) {
      const driverExpense = new Expense({
        driver: new mongoose.Types.ObjectId(driver),
        category: "driver_rent",
        amount: finalAmount,
        details: (details || "").trim(),
        date: date ? new Date(date) : new Date(),
        syncedFromExpense: expense._id, // Track the original expense
      });
      await driverExpense.save();
    }

    // Update carrier's totalExpense (sum of all expenses)
    await updateCarrierTotalExpense(carrierId);

    return NextResponse.json({
      success: true,
      expense: JSON.parse(JSON.stringify(expense)),
    });
  } catch (error) {
    console.error("Error creating expense:", error);
    return NextResponse.json(
      { error: "Failed to create expense" },
      { status: 500 }
    );
  }
}

// Helper function to update carrier's totalExpense
async function updateCarrierTotalExpense(carrierId) {
  const expenses = await Expense.find({ carrier: carrierId });
  const totalExpense = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  await Carrier.findByIdAndUpdate(carrierId, { totalExpense });
}
