import { NextResponse } from "next/server";
import connectDB from "@/app/lib/dbConnect";
import Expense from "@/app/lib/models/Expense";
import Carrier from "@/app/lib/models/Carrier";
import { getSession } from "@/app/lib/auth/getSession";
import mongoose from "mongoose";

// PUT - Update an expense
export async function PUT(request, { params }) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { carrierId, expenseId } = resolvedParams;
    if (!carrierId || !expenseId || !mongoose.Types.ObjectId.isValid(carrierId) || !mongoose.Types.ObjectId.isValid(expenseId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Get expense
    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Verify expense belongs to carrier
    if (expense.carrier.toString() !== carrierId) {
      return NextResponse.json({ error: "Expense does not belong to this carrier" }, { status: 400 });
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
    const { category, amount, details, liters, pricePerLiter, date } = body;

    // Validate category if provided
    if (category) {
      const validCategories = ["fuel", "driver_rent", "taxes", "tool_taxes", "on_road", "others"];
      if (!validCategories.includes(category)) {
        return NextResponse.json(
          { error: "Invalid category" },
          { status: 400 }
        );
      }
    }

    // Calculate amount for fuel expenses
    let finalAmount = amount ? parseFloat(amount) : expense.amount;
    if (category === "fuel" || expense.category === "fuel") {
      const finalLiters = liters !== undefined ? parseFloat(liters) : expense.liters;
      const finalPricePerLiter = pricePerLiter !== undefined ? parseFloat(pricePerLiter) : expense.pricePerLiter;
      if (finalLiters && finalPricePerLiter) {
        finalAmount = finalLiters * finalPricePerLiter;
      }
    }

    // Update expense
    const updateData = {};
    if (category) updateData.category = category;
    if (amount !== undefined) updateData.amount = finalAmount;
    if (details !== undefined) updateData.details = details || "";
    if (date) updateData.date = new Date(date);
    
    if (category === "fuel" || expense.category === "fuel") {
      if (liters !== undefined) updateData.liters = parseFloat(liters);
      if (pricePerLiter !== undefined) updateData.pricePerLiter = parseFloat(pricePerLiter);
    } else {
      // Clear fuel-specific fields if category changed
      updateData.liters = undefined;
      updateData.pricePerLiter = undefined;
    }

    const updatedExpense = await Expense.findByIdAndUpdate(
      expenseId,
      { $set: updateData },
      { new: true }
    ).lean();

    // Update carrier's totalExpense
    const expenses = await Expense.find({ carrier: carrierId });
    const totalExpense = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    await Carrier.findByIdAndUpdate(carrierId, { totalExpense });

    return NextResponse.json({
      success: true,
      expense: JSON.parse(JSON.stringify(updatedExpense)),
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
    const { carrierId, expenseId } = resolvedParams;
    if (!carrierId || !expenseId || !mongoose.Types.ObjectId.isValid(carrierId) || !mongoose.Types.ObjectId.isValid(expenseId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Get expense
    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Verify expense belongs to carrier
    if (expense.carrier.toString() !== carrierId) {
      return NextResponse.json({ error: "Expense does not belong to this carrier" }, { status: 400 });
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

    // Delete expense
    await Expense.findByIdAndDelete(expenseId);

    // Update carrier's totalExpense
    const expenses = await Expense.find({ carrier: carrierId });
    const totalExpense = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    await Carrier.findByIdAndUpdate(carrierId, { totalExpense });

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
