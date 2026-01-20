import { NextResponse } from "next/server";
import connectDB from "@/app/lib/dbConnect";
import Car from "@/app/lib/models/Car";
import { getSession } from "@/app/lib/auth/getSession";
import mongoose from "mongoose";

export async function GET(request, { params }) {
  try {
    const { carrierId } = await params;
    await connectDB();

    // Get session for user filtering
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

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const companyFilter = searchParams.get("company");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const query = { carrier: carrierObjectId };
    
    // Filter by userId if user is not super admin
    if (session.role !== "super_admin") {
      const userObjectId = mongoose.Types.ObjectId.isValid(session.userId) 
        ? new mongoose.Types.ObjectId(session.userId)
        : session.userId;
      query.userId = userObjectId;
    }

    // Apply company filter if provided - search by companyName
    // Decode URL-encoded company name (handles + as spaces and %20)
    if (companyFilter) {
      let decodedCompany = decodeURIComponent(companyFilter);
      // Also handle + signs which are URL-encoded spaces
      decodedCompany = decodedCompany.replace(/\+/g, ' ').trim();
      // Use exact match (case-insensitive) for accuracy
      const escapedCompany = decodedCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.companyName = { $regex: `^${escapedCompany}$`, $options: "i" };
      console.log(`[API /carriers/${carrierId}/cars] Company filter:`, {
        original: companyFilter,
        decoded: decodedCompany,
        regex: query.companyName
      });
    }

    // Apply date filter if provided
    if (startDate || endDate) {
      const dateQuery = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateQuery.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.$lte = end;
      }
      query.date = dateQuery;
    }

    console.log(`[API /carriers/${carrierId}/cars] Query:`, JSON.stringify(query));
    
    const cars = await Car.find(query)
      .populate("carrier", "tripNumber name type date totalExpense")
      .sort({ date: 1, createdAt: 1 })
      .lean();

    console.log(`[API /carriers/${carrierId}/cars] Found ${cars.length} cars`);

    return NextResponse.json({
      success: true,
      cars: JSON.parse(JSON.stringify(cars)),
    });
  } catch (error) {
    console.error("Error fetching cars:", error);
    return NextResponse.json(
      { error: "Failed to fetch cars" },
      { status: 500 }
    );
  }
}
