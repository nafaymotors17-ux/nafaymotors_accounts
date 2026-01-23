"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import connectDB from "@/app/lib/dbConnect";
import Carrier from "@/app/lib/models/Carrier";
import Car from "@/app/lib/models/Car";
import { getSession } from "@/app/lib/auth/getSession";

export async function getAllCarriers(searchParams = {}) {
  await connectDB();
  try {
    const page = parseInt(searchParams.page) || 1;
    const limit = parseInt(searchParams.limit) || 10;
    const skip = (page - 1) * limit;

    const session = await getSession();
    if (!session) {
      return { carriers: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } };
    }

    // Build carrier match conditions
    const carrierMatchConditions = [];
    
    // Filter by userId - super admin can filter by any user via searchParams, others use their own userId
    if (searchParams.userId && session.role === "super_admin") {
      // Super admin filtering by specific user
      if (mongoose.Types.ObjectId.isValid(searchParams.userId)) {
        carrierMatchConditions.push({ userId: new mongoose.Types.ObjectId(searchParams.userId) });
      }
    } else if (session.role !== "super_admin" && session.userId) {
      // Regular users see only their own carriers
      if (mongoose.Types.ObjectId.isValid(session.userId)) {
        carrierMatchConditions.push({ userId: new mongoose.Types.ObjectId(session.userId) });
      }
    }
    
    // Filter by carrier type
    if (searchParams.type) {
      carrierMatchConditions.push({ type: searchParams.type });
    }
    
    // Filter by active/inactive status
    if (searchParams.isActive !== undefined && searchParams.isActive !== "") {
      const isActiveValue = searchParams.isActive === "true" || searchParams.isActive === true;
      if (isActiveValue) {
        carrierMatchConditions.push({
          $or: [
            { isActive: true },
            { isActive: { $exists: false } },
            { isActive: null }
          ]
        });
      } else {
        carrierMatchConditions.push({ isActive: false });
      }
    }
    
    // Filter by carrier name
    if (searchParams.carrierName) {
      const carrierNameFilter = decodeURIComponent(searchParams.carrierName).trim();
      if (carrierNameFilter) {
        const escapedCarrierName = carrierNameFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        carrierMatchConditions.push({ carrierName: { $regex: escapedCarrierName, $options: "i" } });
      }
    }
    
    // Global search across multiple fields
    if (searchParams.globalSearch) {
      const globalSearchTerm = decodeURIComponent(searchParams.globalSearch).trim();
      if (globalSearchTerm) {
        const escapedSearch = globalSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = { $regex: escapedSearch, $options: "i" };
        carrierMatchConditions.push({
          $or: [
            { carrierName: searchRegex },
            { driverName: searchRegex },
            { details: searchRegex },
            { notes: searchRegex }
          ]
        });
      }
    }
    
    // Date filter for carriers
    if (searchParams.startDate && searchParams.endDate) {
      const startDate = new Date(searchParams.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(searchParams.endDate);
      endDate.setHours(23, 59, 59, 999);
      carrierMatchConditions.push({ date: { $gte: startDate, $lte: endDate } });
    }

    // Build car lookup match conditions
    const carLookupMatchConditions = [
      { $expr: { $eq: ["$carrier", "$$carrierId"] } }
    ];
    
    // Company filter for cars
    if (searchParams.company) {
      let companyFilter = decodeURIComponent(searchParams.company);
      companyFilter = companyFilter.replace(/\+/g, ' ').trim();
      const escapedCompany = companyFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      carLookupMatchConditions.push({ companyName: { $regex: `^${escapedCompany}$`, $options: "i" } });
    }

    // Date filter for cars
    if (searchParams.startDate || searchParams.endDate) {
      const dateQuery = {};
      if (searchParams.startDate) {
        const startDate = new Date(searchParams.startDate);
        startDate.setHours(0, 0, 0, 0);
        dateQuery.$gte = startDate;
      }
      if (searchParams.endDate) {
        const endDate = new Date(searchParams.endDate);
        endDate.setHours(23, 59, 59, 999);
        dateQuery.$lte = endDate;
      }
      if (Object.keys(dateQuery).length > 0) {
        carLookupMatchConditions.push({ date: dateQuery });
      }
    }

    const carLookupMatch = carLookupMatchConditions.length === 1 
      ? carLookupMatchConditions[0]
      : { $and: carLookupMatchConditions };
    
    const hasCarFilters = carLookupMatchConditions.length > 1; // More than just the carrier match

    // Build carrier match stage
    const carrierMatch = carrierMatchConditions.length === 0
      ? {}
      : carrierMatchConditions.length === 1
      ? carrierMatchConditions[0]
      : { $and: carrierMatchConditions };

    // Single aggregation pipeline using $facet to get both results and count in one query
    const [result] = await Carrier.aggregate([
      { $match: carrierMatch },
      {
        $lookup: {
          from: "cars",
          let: { carrierId: "$_id" },
          pipeline: [{ $match: carLookupMatch }],
          as: "cars",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $addFields: {
          carCount: { $size: "$cars" },
          totalAmount: { $sum: "$cars.amount" },
          profit: { $subtract: ["$totalAmount", { $ifNull: ["$totalExpense", 0] }] },
          user: { $arrayElemAt: ["$user", 0] },
        },
      },
      // Filter out carriers with no matching cars when car filters are applied
      ...(hasCarFilters ? [{ $match: { carCount: { $gt: 0 } } }] : []),
      {
        $facet: {
          // Results pipeline
          results: [
            { $sort: { date: -1, createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                tripNumber: 1,
                name: 1,
                type: 1,
                date: 1,
                totalExpense: 1,
                carrierName: 1,
                driverName: 1,
                details: 1,
                notes: 1,
                isActive: 1,
                createdAt: 1,
                updatedAt: 1,
                carCount: 1,
                totalAmount: 1,
                profit: 1,
                cars: 1,
                userId: 1,
                user: { username: 1, role: 1 },
              },
            },
          ],
          // Count pipeline
          total: [{ $count: "count" }],
        },
      },
    ]);

    const carriers = result.results || [];
    const total = result.total[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    // Convert ObjectIds to strings
    const carriersWithIds = carriers.map((carrier) => ({
      ...carrier,
      _id: carrier._id.toString(),
      cars: (carrier.cars || []).map((car) => ({
        ...car,
        _id: car._id.toString(),
        company: car.company?.toString(),
        companyName: car.companyName || "",
        carrier: car.carrier?.toString(),
      })),
    }));

    return {
      carriers: JSON.parse(JSON.stringify(carriersWithIds)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  } catch (error) {
    return {
      carriers: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }
}

export async function getCarrierById(carrierId) {
  await connectDB();
  try {
    const carrier = await Carrier.findById(carrierId).lean();
    if (!carrier) {
      return { error: "Carrier not found" };
    }

    const session = await getSession();
    const carQuery = { carrier: carrierId };
    
    // Filter by location if user is not super admin
    if (session && session.role !== "super_admin" && session.location) {
      carQuery.location = session.location;
    }
    
    const cars = await Car.find(carQuery)
      .populate("carrier", "tripNumber name type date totalExpense")
      .sort({ date: 1 })
      .lean();

    const totalAmount = cars.reduce((sum, car) => sum + (car.amount || 0), 0);
    const profit = totalAmount - (carrier.totalExpense || 0);

    return {
      carrier: JSON.parse(JSON.stringify(carrier)),
      cars: JSON.parse(JSON.stringify(cars)),
      totalAmount,
      profit,
    };
  } catch (error) {
    return { error: "Failed to fetch carrier" };
  }
}

// Generate next unique trip number for a user
export async function generateNextTripNumber(userId = null) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    // Determine target user
    let targetUserId = userId || session.userId;
    if (mongoose.Types.ObjectId.isValid(targetUserId)) {
      targetUserId = new mongoose.Types.ObjectId(targetUserId);
    }

    // Find all trip numbers for this user and extract the highest numeric value
    const trips = await Carrier.find({
      type: "trip",
      userId: targetUserId,
      tripNumber: { $exists: true, $ne: null },
    })
      .select("tripNumber")
      .lean();

    let maxNumber = 0;
    trips.forEach((trip) => {
      if (trip.tripNumber) {
        // Extract number from trip number (e.g., "TRIP-001" -> 1, "TRIP-123" -> 123)
        const match = trip.tripNumber.match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      }
    });

    // Generate next number
    const nextNumber = maxNumber + 1;

    // Format as TRIP-XXX with zero padding
    const tripNumber = `TRIP-${String(nextNumber).padStart(3, "0")}`;

    return { success: true, tripNumber };
  } catch (error) {
    console.error("Error generating trip number:", error);
    return { error: "Failed to generate trip number" };
  }
}

export async function createCarrier(formData) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    let tripNumber = formData.get("tripNumber")?.trim();
    const name = formData.get("name")?.trim();
    const type = formData.get("type") || "trip";
    const date = formData.get("date");
    const totalExpense = parseFloat(formData.get("totalExpense") || "0");
    const carrierName = formData.get("carrierName")?.trim() || "";
    const driverName = formData.get("driverName")?.trim() || "";
    const details = formData.get("details")?.trim() || "";
    const notes = formData.get("notes")?.trim() || "";
    
    // Super admin can select userId, regular users use their own
    const selectedUserId = formData.get("userId");
    let targetUserId = (session.role === "super_admin" && selectedUserId) 
      ? selectedUserId 
      : session.userId;
    
    // Convert userId to ObjectId if it's a valid string
    if (mongoose.Types.ObjectId.isValid(targetUserId)) {
      targetUserId = new mongoose.Types.ObjectId(targetUserId);
    }

    // Auto-generate trip number if not provided
    if (type === "trip" && !tripNumber) {
      const generated = await generateNextTripNumber(targetUserId);
      if (generated.error) {
        return { error: generated.error };
      }
      tripNumber = generated.tripNumber;
    }

    if (type === "trip" && !tripNumber) {
      return { error: "Trip number is required for trip-type carriers" };
    }


    // Check if trip number already exists (for the target user) - enforce uniqueness
    if (type === "trip" && tripNumber) {
      const existingCarrier = await Carrier.findOne({ 
        tripNumber: tripNumber.trim().toUpperCase(), 
        type: "trip", 
        userId: targetUserId 
      });
      if (existingCarrier) {
        return { 
          error: `Trip number "${tripNumber}" already exists for this user. Please use a different trip number.` 
        };
      }
    }

    // Check if company name already exists
    if (type === "company" && name) {
      const upperName = name.trim().toUpperCase();
      const existingCarrier = await Carrier.findOne({ 
        name: upperName, 
        type: "company", 
        userId: targetUserId 
      });
      if (existingCarrier) {
        return { 
          error: `Company name "${upperName}" already exists for this user. Please use a different name.` 
        };
      }
    }

    // Create new carrier
    const carrier = new Carrier({
      tripNumber: type === "trip" ? tripNumber : undefined,
      name: type === "company" ? name.trim().toUpperCase() : undefined,
      type,
      userId: targetUserId,
      date: date ? new Date(date) : new Date(),
      totalExpense: totalExpense || 0,
      carrierName: carrierName || "",
      driverName: driverName || "",
      details: details || "",
      notes: notes || "",
      isActive: true, // Newly created trips are active by default
    });

    try {
      await carrier.save();
      revalidatePath("/carrier-trips");

      return {
        success: true,
        carrier: JSON.parse(JSON.stringify(carrier)),
        message: type === "trip" ? "Carrier trip created successfully" : "Company created successfully",
      };
    } catch (saveError) {
      // Handle duplicate key error (E11000) - database might still have unique index
      if (saveError.code === 11000) {
        // Try to find the existing carrier
        let foundCarrier;
        if (type === "trip") {
          foundCarrier = await Carrier.findOne({ tripNumber, type: "trip", userId: targetUserId });
        } else {
          const upperName = name.trim().toUpperCase();
          foundCarrier = await Carrier.findOne({ name: upperName, type: "company", userId: targetUserId });
        }
        
        if (foundCarrier) {
          revalidatePath("/carrier-trips");
          return {
            success: true,
            carrier: JSON.parse(JSON.stringify(foundCarrier)),
            message: type === "trip" ? "Carrier trip already exists" : "Company already exists",
            warning: type === "trip" ? "Trip number already exists - using existing trip" : "Company name already exists - using existing company",
          };
        }
      }
      throw saveError; // Re-throw if not a duplicate key error
    }
  } catch (error) {
    // If it's still a duplicate key error after our handling, show warning
    if (error.code === 11000) {
      // Get type from formData in case it wasn't set in try block
      const errorType = formData.get("type") || "trip";
      return {
        success: true,
        warning: errorType === "trip" ? "Trip number already exists" : "Company name already exists",
        message: "Carrier may already exist. Please check the list.",
      };
    }
    return { error: "Failed to create carrier" };
  }
}

export async function updateCarrierExpense(carrierId, formData) {
  await connectDB();
  try {
    const expense = formData.get("totalExpense");
    const carrierName = formData.get("carrierName")?.trim() || "";
    const driverName = formData.get("driverName")?.trim() || "";
    const details = formData.get("details")?.trim() || "";
    const notes = formData.get("notes")?.trim() || "";
    
    const updateData = {
      totalExpense: parseFloat(expense) || 0,
    };
    
    // Update carrier name, driver name, details, and notes
    if (carrierName !== undefined) {
      updateData.carrierName = carrierName;
    }
    if (driverName !== undefined) {
      updateData.driverName = driverName;
    }
    if (details !== undefined) {
      updateData.details = details;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    
    const carrier = await Carrier.findByIdAndUpdate(
      carrierId,
      { $set: updateData },
      { new: true }
    ).lean();

    if (!carrier) {
      return { error: "Carrier not found" };
    }

    revalidatePath("/carriers");
    revalidatePath("/carrier-trips");
    return {
      success: true,
      carrier: JSON.parse(JSON.stringify(carrier)),
    };
  } catch (error) {
    return { error: "Failed to update expense" };
  }
}

export async function toggleCarrierActiveStatus(carrierId) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    // Convert carrierId to ObjectId if it's a string
    let carrierIdObj = carrierId;
    if (typeof carrierId === 'string' && mongoose.Types.ObjectId.isValid(carrierId)) {
      carrierIdObj = new mongoose.Types.ObjectId(carrierId);
    }

    const carrier = await Carrier.findById(carrierIdObj);
    if (!carrier) {
      return { error: "Carrier not found" };
    }

    // Check if user has permission (must be owner or super admin)
    const carrierUserId = carrier.userId?.toString();
    const sessionUserId = session.userId?.toString();
    
    if (session.role !== "super_admin" && carrierUserId !== sessionUserId) {
      return { error: "Unauthorized to modify this carrier" };
    }

    // Toggle active status
    // Handle undefined/null as active (true) for backward compatibility
    const currentStatus = carrier.isActive !== false; // true if undefined/null/true
    carrier.isActive = !currentStatus; // Toggle to opposite
    
    await carrier.save();

    revalidatePath("/carriers");
    return {
      success: true,
      carrier: JSON.parse(JSON.stringify(carrier)),
      message: carrier.isActive ? "Trip marked as active" : "Trip marked as inactive",
    };
  } catch (error) {
    return { error: `Failed to update trip status: ${error.message}` };
  }
}

export async function deleteCarrier(carrierId) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    // Only super admin can delete carriers
    if (session.role !== "super_admin") {
      return { error: "Only super admin can delete trips" };
    }

    // Convert carrierId to ObjectId if it's a string
    let carrierIdObj = carrierId;
    if (typeof carrierId === 'string' && mongoose.Types.ObjectId.isValid(carrierId)) {
      carrierIdObj = new mongoose.Types.ObjectId(carrierId);
    }

    // Find the carrier first to verify it exists
    const carrier = await Carrier.findById(carrierIdObj);
    if (!carrier) {
      return { error: "Carrier trip not found" };
    }

    // Delete all cars associated with this carrier
    const deleteCarsResult = await Car.deleteMany({ carrier: carrierIdObj });
    
    // Delete the carrier
    await Carrier.findByIdAndDelete(carrierIdObj);

    revalidatePath("/carrier-trips");
    return {
      success: true,
      message: `Trip and ${deleteCarsResult.deletedCount} associated car(s) deleted successfully`,
      deletedCarsCount: deleteCarsResult.deletedCount,
    };
  } catch (error) {
    console.error("Error deleting carrier:", error);
    return { error: `Failed to delete trip: ${error.message}` };
  }
}

export async function getFilteredCarriersWithCars(searchParams = {}) {
  await connectDB();
  try {
    const page = parseInt(searchParams.page) || 1;
    const limit = parseInt(searchParams.limit) || 10;
    const skip = (page - 1) * limit;

    const session = await getSession();
    if (!session) {
      return { carriers: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } };
    }

    // Build car filter query
    const carQuery = {};
    
    // Filter by userId if user is not super admin
    if (session.role !== "super_admin" && session.userId) {
      // Convert userId string to ObjectId for proper querying in aggregation pipeline
      if (mongoose.Types.ObjectId.isValid(session.userId)) {
        carQuery.userId = new mongoose.Types.ObjectId(session.userId);
      } else {
        carQuery.userId = session.userId;
      }
    }
    
    // Company filter - search by companyName
    if (searchParams.company) {
      carQuery.companyName = { $regex: searchParams.company, $options: "i" };
    }

    // Date filter for cars
    if (searchParams.startDate || searchParams.endDate) {
      const dateQuery = {};
      if (searchParams.startDate) {
        const startDate = new Date(searchParams.startDate);
        startDate.setHours(0, 0, 0, 0);
        dateQuery.$gte = startDate;
      }
      if (searchParams.endDate) {
        const endDate = new Date(searchParams.endDate);
        endDate.setHours(23, 59, 59, 999);
        dateQuery.$lte = endDate;
      }
      carQuery.date = dateQuery;
    }

    // Find carriers that have cars matching the filters
    const matchingCars = await Car.find(carQuery).distinct("carrier");
    
    if (matchingCars.length === 0) {
      return {
        carriers: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    // Get carriers with their filtered cars
    const carriers = await Carrier.aggregate([
      { $match: { _id: { $in: matchingCars } } },
      {
        $lookup: {
          from: "cars",
          let: { carrierId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$carrier", "$$carrierId"] },
                ...carQuery,
              },
            },
          ],
          as: "cars",
        },
      },
      {
        $addFields: {
          carCount: { $size: "$cars" },
          totalAmount: { $sum: "$cars.amount" },
        },
      },
      {
        $addFields: {
          profit: {
            $subtract: ["$totalAmount", { $ifNull: ["$totalExpense", 0] }],
          },
        },
      },
      { $sort: { date: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    // Get total count
    const total = await Carrier.countDocuments({ _id: { $in: matchingCars } });
    const totalPages = Math.ceil(total / limit);

    // Convert ObjectIds to strings and format cars
    const carriersWithIds = carriers.map((carrier) => ({
      ...carrier,
      _id: carrier._id.toString(),
      cars: (carrier.cars || []).map((car) => ({
        ...car,
        _id: car._id.toString(),
        companyName: car.companyName || "",
        carrier: car.carrier?.toString(),
      })),
    }));

    return {
      carriers: JSON.parse(JSON.stringify(carriersWithIds)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  } catch (error) {
    return {
      carriers: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }
}