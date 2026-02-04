import { NextResponse } from "next/server";
import connectDB from "@/app/lib/dbConnect";
import Truck from "@/app/lib/models/Truck";
import { getSession } from "@/app/lib/auth/getSession";
import mongoose from "mongoose";

// GET - Get a specific truck
export async function GET(request, { params }) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { truckId } = resolvedParams;
    
    if (!truckId || !mongoose.Types.ObjectId.isValid(truckId)) {
      return NextResponse.json({ error: "Invalid truck ID" }, { status: 400 });
    }

    // Get truck with populated drivers
    const truck = await Truck.findById(truckId)
      .populate("drivers", "name phone email licenseNumber")
      .lean();

    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Check permissions
    if (session.role !== "super_admin" && truck.userId.toString() !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({
      truck: JSON.parse(JSON.stringify(truck)),
    });
  } catch (error) {
    console.error("Error fetching truck:", error);
    return NextResponse.json(
      { error: "Failed to fetch truck" },
      { status: 500 }
    );
  }
}
