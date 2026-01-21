import { NextResponse } from "next/server";
import connectDB from "@/app/lib/dbConnect";
import Carrier from "@/app/lib/models/Carrier";
import { getSession } from "@/app/lib/auth/getSession";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";

export async function POST(request, { params }) {
  try {
    const { carrierId } = await params;
    await connectDB();

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Validate and convert ObjectId
    if (!mongoose.Types.ObjectId.isValid(carrierId)) {
      return NextResponse.json(
        { error: "Invalid carrier ID" },
        { status: 400 }
      );
    }

    const carrierObjectId = new mongoose.Types.ObjectId(carrierId);

    const carrier = await Carrier.findById(carrierObjectId);
    if (!carrier) {
      return NextResponse.json(
        { error: "Carrier not found" },
        { status: 404 }
      );
    }

    // Check if user has permission (must be owner or super admin)
    const carrierUserId = carrier.userId?.toString();
    const sessionUserId = session.userId?.toString();
    
    if (session.role !== "super_admin" && carrierUserId !== sessionUserId) {
      return NextResponse.json(
        { error: "Unauthorized to modify this carrier" },
        { status: 403 }
      );
    }

    // Toggle active status
    // Handle undefined/null as active (true) for backward compatibility
    const currentStatus = carrier.isActive !== false; // true if undefined/null/true
    carrier.isActive = !currentStatus; // Toggle to opposite
    
    console.log("Toggling carrier active status", {
      carrierId: carrier._id.toString(),
      oldStatus: currentStatus,
      newStatus: carrier.isActive
    });
    
    await carrier.save();

    revalidatePath("/carrier-trips");

    return NextResponse.json({
      success: true,
      carrier: JSON.parse(JSON.stringify(carrier)),
      message: carrier.isActive ? "Trip marked as active" : "Trip marked as inactive",
    });
  } catch (error) {
    console.error("Error toggling carrier active status:", error);
    return NextResponse.json(
      { error: `Failed to update trip status: ${error.message}` },
      { status: 500 }
    );
  }
}
