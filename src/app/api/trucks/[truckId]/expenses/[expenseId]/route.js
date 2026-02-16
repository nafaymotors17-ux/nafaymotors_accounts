import { NextResponse } from "next/server";
import connectDB from "@/app/lib/dbConnect";
import Expense from "@/app/lib/models/Expense";
import { getSession } from "@/app/lib/auth/getSession";
import mongoose from "mongoose";

// GET - Get a specific expense
export async function GET(request, { params }) {
  await connectDB();
  try {
    const Truck = (await import("@/app/lib/models/Truck")).default;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { truckId, expenseId } = resolvedParams;

    if (!truckId || !mongoose.Types.ObjectId.isValid(truckId)) {
      return NextResponse.json({ error: "Invalid truck ID" }, { status: 400 });
    }

    if (!expenseId || !mongoose.Types.ObjectId.isValid(expenseId)) {
      return NextResponse.json({ error: "Invalid expense ID" }, { status: 400 });
    }

    // Get truck to check permissions
    const truck = await Truck.findById(truckId);
    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Check permissions
    if (session.role !== "super_admin" && truck.userId.toString() !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get expense
    const expense = await Expense.findOne({ _id: expenseId, truck: truckId }).lean();

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({
      expense: JSON.parse(JSON.stringify(expense)),
    });
  } catch (error) {
    console.error("Error fetching expense:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense" },
      { status: 500 }
    );
  }
}

// PUT - Update an expense
export async function PUT(request, { params }) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { truckId, expenseId } = resolvedParams;

    if (!truckId || !mongoose.Types.ObjectId.isValid(truckId)) {
      return NextResponse.json({ error: "Invalid truck ID" }, { status: 400 });
    }

    if (!expenseId || !mongoose.Types.ObjectId.isValid(expenseId)) {
      return NextResponse.json({ error: "Invalid expense ID" }, { status: 400 });
    }

    // Get truck to check permissions
    const truck = await Truck.findById(truckId);
    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Check permissions
    if (session.role !== "super_admin" && truck.userId.toString() !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get expense
    const existingExpense = await Expense.findOne({ _id: expenseId, truck: truckId });
    if (!existingExpense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const body = await request.json();
    const { category, amount, details, liters, pricePerLiter, date, tyreNumber, tyreInfo } = body;

    // Validate category if provided - allow maintenance, fuel, tyre, and others for trucks
    if (category) {
      const validCategories = ["maintenance", "fuel", "tyre", "others"];
      if (!validCategories.includes(category)) {
        return NextResponse.json(
          { error: "Invalid category. Only maintenance, fuel, tyre, and others are allowed for trucks." },
          { status: 400 }
        );
      }
    }

    // Calculate amount for fuel expenses
    let finalAmount = amount ? parseFloat(amount) : existingExpense.amount;
    if (category === "fuel" || existingExpense.category === "fuel") {
      if (liters && pricePerLiter) {
        finalAmount = parseFloat(liters) * parseFloat(pricePerLiter);
      }
    }

    // Update expense
    existingExpense.category = category || existingExpense.category;
    existingExpense.amount = finalAmount;
    existingExpense.details = details !== undefined ? details : existingExpense.details;
    existingExpense.liters = category === "fuel" && liters ? parseFloat(liters) : (category !== "fuel" ? undefined : existingExpense.liters);
    existingExpense.pricePerLiter = category === "fuel" && pricePerLiter ? parseFloat(pricePerLiter) : (category !== "fuel" ? undefined : existingExpense.pricePerLiter);
    existingExpense.tyreNumber = category === "tyre" && tyreNumber !== undefined ? tyreNumber.trim() : (category !== "tyre" ? undefined : existingExpense.tyreNumber);
    existingExpense.tyreInfo = category === "tyre" && tyreInfo !== undefined ? tyreInfo.trim() : (category !== "tyre" ? undefined : existingExpense.tyreInfo);
    existingExpense.date = date ? new Date(date) : existingExpense.date;

    await existingExpense.save();

    return NextResponse.json({
      success: true,
      expense: JSON.parse(JSON.stringify(existingExpense)),
    });
  } catch (error) {
    console.error("Error updating expense:", error);
    return NextResponse.json(
      { error: "Failed to update expense" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an expense
export async function DELETE(request, { params }) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { truckId, expenseId } = resolvedParams;

    if (!truckId || !mongoose.Types.ObjectId.isValid(truckId)) {
      return NextResponse.json({ error: "Invalid truck ID" }, { status: 400 });
    }

    if (!expenseId || !mongoose.Types.ObjectId.isValid(expenseId)) {
      return NextResponse.json({ error: "Invalid expense ID" }, { status: 400 });
    }

    // Get truck to check permissions
    const truck = await Truck.findById(truckId);
    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Check permissions
    if (session.role !== "super_admin" && truck.userId.toString() !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete expense
    const expense = await Expense.findOneAndDelete({ _id: expenseId, truck: truckId });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting expense:", error);
    return NextResponse.json(
      { error: "Failed to delete expense" },
      { status: 500 }
    );
  }
}
