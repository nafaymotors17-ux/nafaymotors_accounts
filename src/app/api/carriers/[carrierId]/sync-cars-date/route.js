import { NextResponse } from "next/server";
import connectDB from "@/app/lib/dbConnect";
import Carrier from "@/app/lib/models/Carrier";
import Car from "@/app/lib/models/Car";
import { getSession } from "@/app/lib/auth/getSession";

// POST - Sync trip date to all cars in the trip
export async function POST(request, { params }) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { carrierId } = resolvedParams;

    if (!carrierId) {
      return NextResponse.json({ error: "Invalid carrier ID" }, { status: 400 });
    }

    // Get the carrier/trip
    const carrier = await Carrier.findById(carrierId);
    if (!carrier) {
      return NextResponse.json({ error: "Carrier/Trip not found" }, { status: 404 });
    }

    // Check permissions
    if (session.role !== "super_admin" && carrier.userId.toString() !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get trip date
    const tripDate = carrier.date || new Date();

    // Update all cars in this trip to have the same date
    const result = await Car.updateMany(
      { carrier: carrierId },
      { $set: { date: tripDate } }
    );

    return NextResponse.json({
      success: true,
      message: `Updated ${result.modifiedCount} cars with trip date`,
      carsUpdated: result.modifiedCount,
      tripDate: tripDate,
    });
  } catch (error) {
    console.error("Error syncing cars date:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync cars date" },
      { status: 500 }
    );
  }
}
