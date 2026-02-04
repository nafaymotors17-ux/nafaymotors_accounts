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
    const { category, amount, details, liters, pricePerLiter, date, driver, meterReading } = body;

    // Validate category if provided
    if (category) {
      const validCategories = ["fuel", "driver_rent", "taxes", "tool_taxes", "on_road", "maintenance", "tyre", "others"];
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

    // Validate driver for driver_rent category
    if ((category === "driver_rent" || expense.category === "driver_rent") && !driver && category !== "driver_rent") {
      // If changing from driver_rent to another category, clear driver
      updateData.driver = undefined;
    } else if (category === "driver_rent" && !driver) {
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

    // Handle maintenance-specific fields
    if (category === "maintenance" || expense.category === "maintenance") {
      if (meterReading !== undefined) updateData.meterReading = parseFloat(meterReading);
    } else {
      // Clear maintenance-specific fields if category changed
      updateData.meterReading = undefined;
    }

    // Handle driverRentDriver field
    if (category === "driver_rent" && driver) {
      updateData.driverRentDriver = new mongoose.Types.ObjectId(driver);
    } else if (category !== "driver_rent" && expense.category === "driver_rent") {
      // Clear driver if changing from driver_rent to another category
      updateData.driverRentDriver = undefined;
    }

    const updatedExpense = await Expense.findByIdAndUpdate(
      expenseId,
      { $set: updateData },
      { new: true }
    ).lean();

    // Update synced expenses (truck or driver expenses synced from this expense)
    const syncedExpenses = await Expense.find({ syncedFromExpense: expenseId });
    for (const syncedExpense of syncedExpenses) {
      const syncedUpdateData = {};
      
      // Update common fields
      if (amount !== undefined || (category === "fuel" || expense.category === "fuel")) {
        syncedUpdateData.amount = finalAmount;
      }
      if (details !== undefined) {
        syncedUpdateData.details = (details || "").trim();
      }
      if (date) {
        syncedUpdateData.date = new Date(date);
      }

      // Update fuel-specific fields for truck expenses
      if (syncedExpense.truck && (category === "fuel" || expense.category === "fuel")) {
        if (liters !== undefined) syncedUpdateData.liters = parseFloat(liters);
        if (pricePerLiter !== undefined) syncedUpdateData.pricePerLiter = parseFloat(pricePerLiter);
      }

      // Update driver-specific fields for driver expenses
      if (syncedExpense.driver && category === "driver_rent" && driver) {
        // Update driver reference if changed
        syncedUpdateData.driver = new mongoose.Types.ObjectId(driver);
      }

      if (Object.keys(syncedUpdateData).length > 0) {
        await Expense.findByIdAndUpdate(syncedExpense._id, { $set: syncedUpdateData });
      }
    }

    // If category changed from/to fuel or driver_rent, we may need to create/delete synced expenses
    const finalCategory = category || expense.category;
    const wasFuel = expense.category === "fuel";
    const isFuel = finalCategory === "fuel";
    const wasDriverRent = expense.category === "driver_rent";
    const isDriverRent = finalCategory === "driver_rent";

    // If changed to fuel and truck exists, create synced truck expense if it doesn't exist
    if (isFuel && !wasFuel && carrier.truck) {
      const existingTruckExpense = await Expense.findOne({ 
        syncedFromExpense: expenseId,
        truck: carrier.truck 
      });
      if (!existingTruckExpense) {
        const truckExpense = new Expense({
          truck: carrier.truck,
          category: "fuel",
          amount: finalAmount,
          details: (details || expense.details || "").trim(),
          liters: expense.liters,
          pricePerLiter: expense.pricePerLiter,
          date: date ? new Date(date) : expense.date,
          syncedFromExpense: expenseId,
        });
        await truckExpense.save();
      }
    }

    // If changed to driver_rent and driver exists, create synced driver expense if it doesn't exist
    if (isDriverRent && !wasDriverRent && driver) {
      const existingDriverExpense = await Expense.findOne({ 
        syncedFromExpense: expenseId,
        driver: new mongoose.Types.ObjectId(driver)
      });
      if (!existingDriverExpense) {
        const driverExpense = new Expense({
          driver: new mongoose.Types.ObjectId(driver),
          category: "driver_rent",
          amount: finalAmount,
          details: (details || expense.details || "").trim(),
          date: date ? new Date(date) : expense.date,
          syncedFromExpense: expenseId,
        });
        await driverExpense.save();
      }
    }

    // If changed away from fuel or driver_rent, delete synced expenses
    if ((wasFuel && !isFuel) || (wasDriverRent && !isDriverRent)) {
      await Expense.deleteMany({ syncedFromExpense: expenseId });
    }

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

    // Find and delete any synced expenses (truck or driver expenses synced from this expense)
    const syncedExpenses = await Expense.find({ syncedFromExpense: expenseId });
    if (syncedExpenses.length > 0) {
      await Expense.deleteMany({ syncedFromExpense: expenseId });
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
