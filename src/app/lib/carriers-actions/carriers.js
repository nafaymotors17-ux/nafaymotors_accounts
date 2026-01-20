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

    const query = {};
    const carQuery = {};
    
    // Filter by userId if user is not super admin
    // NOTE: userId should only filter carriers, not cars
    // Cars don't have userId - they belong to carriers which have userId
    if (session.role !== "super_admin" && session.userId) {
      // Convert to ObjectId for proper matching
      if (mongoose.Types.ObjectId.isValid(session.userId)) {
        const userIdObj = new mongoose.Types.ObjectId(session.userId);
        query.userId = userIdObj;
        // DO NOT add userId to carQuery - cars are filtered through their carrier's userId
        console.log("✓ Setting userId filter for carriers:", {
          original: session.userId,
          converted: userIdObj.toString(),
          type: userIdObj.constructor.name,
          isObjectId: userIdObj instanceof mongoose.Types.ObjectId
        });
      } else {
        console.error("✗ Invalid userId format in session:", session.userId);
        query.userId = session.userId;
      }
    } else {
      console.log("⚠ No userId filter applied:", {
        role: session?.role,
        userId: session?.userId,
        isSuperAdmin: session?.role === "super_admin"
      });
    }
    
    // Filter by carrier type (only if explicitly specified)
    // Don't filter by default to show all carriers (for backward compatibility)
    // This allows existing carriers without type field to show up
    if (searchParams.type) {
      query.type = searchParams.type;
    }
    
    // Filter by active/inactive status
    // Store isActive filter separately to handle $or condition properly
    let isActiveFilter = null;
    if (searchParams.isActive !== undefined && searchParams.isActive !== "") {
      const isActiveValue = searchParams.isActive === "true" || searchParams.isActive === true;
      if (isActiveValue) {
        // For active: include isActive=true OR isActive is undefined/null (backward compatibility)
        isActiveFilter = { 
          $or: [
            { isActive: true },
            { isActive: { $exists: false } },
            { isActive: null }
          ]
        };
      } else {
        // For inactive: only include isActive=false
        isActiveFilter = { isActive: false };
      }
    }
    
    // For backward compatibility: if no type filter, show all carriers
    // (both with and without type field)
    
    // Date filter for carriers
    if (searchParams.startDate && searchParams.endDate) {
      const startDate = new Date(searchParams.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(searchParams.endDate);
      endDate.setHours(23, 59, 59, 999);
      
      query.date = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    // Company filter for cars (search by companyName)
    // When company filter is applied, use exact match (case-insensitive) to ensure accuracy
    // This ensures we only get cars with the exact company name, not partial matches
    if (searchParams.company) {
      // Decode URL-encoded company name (handles + as spaces and %20)
      // Next.js should decode it, but we'll ensure it's properly decoded
      let companyFilter = decodeURIComponent(searchParams.company);
      // Also handle + signs which are URL-encoded spaces
      companyFilter = companyFilter.replace(/\+/g, ' ').trim();
      
      // Escape special regex characters and use exact match
      const escapedCompany = companyFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      carQuery.companyName = { $regex: `^${escapedCompany}$`, $options: "i" };
      console.log("🔍 Company filter applied (exact match):", { 
        original: searchParams.company,
        decoded: companyFilter,
        escaped: escapedCompany,
        regex: carQuery.companyName
      });
    }

    // Date filter for cars (if provided)
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

    // Log query details for debugging
    console.log("🔍 Query details:", {
      query: {
        ...query,
        userId: query.userId ? (query.userId instanceof mongoose.Types.ObjectId ? query.userId.toString() : query.userId) : undefined
      },
      carQuery: {
        ...carQuery,
        userId: carQuery.userId ? (carQuery.userId instanceof mongoose.Types.ObjectId ? carQuery.userId.toString() : carQuery.userId) : undefined
      },
      session: {
        userId: session.userId,
        role: session.role
      }
    });

    // If car-specific filters are applied (company, date), only get carriers that have matching cars
    // NOTE: userId is NOT a car filter - it filters carriers directly
    // IMPORTANT: When filtering by company/date, we must only search cars that belong to user's carriers
    let matchingCarrierIds = null;
    const hasCarFilters = Object.keys(carQuery).length > 0;
    if (hasCarFilters) {
      console.log("🔍 Car filters detected - will restrict to carriers with matching cars");
      
      // If userId filter is applied, first get all carrier IDs owned by this user
      // Then only search for cars that belong to those carriers
      let userCarrierIds = null;
      if (query.userId) {
        const userIdObj = query.userId instanceof mongoose.Types.ObjectId 
          ? query.userId 
          : new mongoose.Types.ObjectId(query.userId);
        userCarrierIds = await Carrier.find({ userId: userIdObj }).distinct("_id");
        console.log("🔍 User's carrier IDs (for car filtering):", {
          count: userCarrierIds.length,
          carrierIds: userCarrierIds.map(id => id.toString())
        });
        
        // If user has no carriers, return empty
        if (userCarrierIds.length === 0) {
          return {
            carriers: [],
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPrevPage: false,
            },
          };
        }
      }
      
      // Create a separate query for finding matching cars
      // Include carrier filter if userId is specified (to only search user's carriers)
      const carSearchQuery = { ...carQuery };
      if (userCarrierIds && userCarrierIds.length > 0) {
        carSearchQuery.carrier = { $in: userCarrierIds };
      }
      
      // Find cars matching the filters (company, date, etc.)
      const matchingCars = await Car.find(carSearchQuery).distinct("carrier");
      console.log("🔍 Matching cars found (with car filters):", {
        count: matchingCars.length,
        carrierIds: matchingCars.map(id => id.toString()),
        carFilters: Object.keys(carQuery),
        filteredByUserCarriers: userCarrierIds !== null,
        carSearchQueryKeys: Object.keys(carSearchQuery)
      });
      
      // CRITICAL: When car filters are applied, we MUST have matching carriers
      // If no matching cars found, return empty - don't show any carriers
      if (matchingCars.length === 0) {
        console.log("⚠️ No matching cars found - returning empty result");
        return {
          carriers: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
      }
      
      // Store matching carrier IDs - these are the ONLY carriers we should show
      // Convert to ObjectIds if they aren't already
      matchingCarrierIds = matchingCars.map(id => 
        id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
      );
      
      console.log("✅ Restricting to carriers with matching cars:", {
        count: matchingCarrierIds.length,
        firstFewIds: matchingCarrierIds.slice(0, 5).map(id => id.toString())
      });
    } else {
      console.log("🔍 No car-specific filters - will show all carriers matching query");
    }

    // Build match stage - handle userId separately for proper ObjectId matching in aggregation
    const otherConditions = {};
    
    // Copy all query conditions except userId and _id (we handle _id separately)
    Object.keys(query).forEach(key => {
      if (key !== 'userId' && key !== '_id' && query[key] !== undefined && query[key] !== null) {
        otherConditions[key] = query[key];
      }
    });
    
    // Build final match stage
    // IMPORTANT: When car filters are applied, matchingCarrierIds MUST be used to restrict results
    let matchStage;
    const matchConditions = [];
    
    if (query.userId) {
      const userIdObj = query.userId instanceof mongoose.Types.ObjectId 
        ? query.userId 
        : new mongoose.Types.ObjectId(query.userId);
      
      // Always include userId filter for non-admin users
      matchConditions.push({ userId: userIdObj });
    }
    
    // Add other conditions (date, type, etc.) - carrier-level filters
    if (Object.keys(otherConditions).length > 0) {
      matchConditions.push(otherConditions);
    }
    
    // Add isActive filter if specified (handles $or for active trips)
    if (isActiveFilter) {
      matchConditions.push(isActiveFilter);
    }
    
    // CRITICAL: If we have matching carrier IDs from car filters (company, car date, etc.),
    // we MUST restrict to only those carriers - this is the main filter
    // When car filters are applied, matchingCarrierIds MUST be set and used
    if (hasCarFilters) {
      if (!matchingCarrierIds || matchingCarrierIds.length === 0) {
        // This shouldn't happen - we should have returned empty earlier
        // But add safeguard just in case
        console.error("⚠️ ERROR: Car filters present but no matchingCarrierIds - returning empty");
        return {
          carriers: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
      }
      // ALWAYS restrict to matching carriers when car filters are present
      matchConditions.push({ _id: { $in: matchingCarrierIds } });
      console.log("🔍 Applying carrier ID filter from car filters:", {
        count: matchingCarrierIds.length,
        carrierIds: matchingCarrierIds.slice(0, 5).map(id => id.toString()) // Show first 5
      });
    } else if (matchingCarrierIds && matchingCarrierIds.length > 0) {
      // This shouldn't happen (matchingCarrierIds should only be set when hasCarFilters is true)
      // But handle it just in case
      matchConditions.push({ _id: { $in: matchingCarrierIds } });
      console.log("🔍 Applying carrier ID filter (unexpected case):", {
        count: matchingCarrierIds.length
      });
    }
    
    // Combine all conditions
    if (matchConditions.length === 0) {
      // No filters at all - show everything (shouldn't happen, but handle it)
      matchStage = {};
    } else if (matchConditions.length === 1) {
      matchStage = matchConditions[0];
    } else {
      // Multiple conditions - use $and
      matchStage = { $and: matchConditions };
    }
    
    console.log("🔍 Final match stage:", {
      hasUserId: query.userId !== undefined,
      hasOtherConditions: Object.keys(otherConditions).length > 0,
      hasMatchingCarrierIds: matchingCarrierIds !== null && matchingCarrierIds.length > 0,
      matchConditionsCount: matchConditions.length,
      matchStageKeys: Object.keys(matchStage),
      matchStage: JSON.stringify(matchStage, (key, value) => {
        // Convert ObjectId to string for JSON serialization
        if (value instanceof mongoose.Types.ObjectId) {
          return value.toString();
        }
        if (Array.isArray(value)) {
          return value.map(v => {
            if (v instanceof mongoose.Types.ObjectId) {
              return v.toString();
            }
            return v;
          });
        }
        return value;
      }, 2)
    });

    // Use aggregation pipeline
    console.log("🔍 Executing aggregation with matchStage:", JSON.stringify(matchStage, null, 2));
    
    // Build car lookup match conditions properly
    // When car filters are applied, we MUST filter cars in the lookup
    const carLookupMatchConditions = [
      { $expr: { $eq: ["$carrier", "$$carrierId"] } }
    ];
    
    // Add car filters (company, date, etc.) if present
    // These filters should be applied to the cars in the lookup
    if (Object.keys(carQuery).length > 0) {
      // Combine car filters with $and to ensure they're all applied
      carLookupMatchConditions.push(carQuery);
    }
    
    const carLookupMatch = carLookupMatchConditions.length === 1 
      ? carLookupMatchConditions[0]
      : { $and: carLookupMatchConditions };
    
    console.log("🔍 Car lookup match conditions:", {
      hasCarFilters: Object.keys(carQuery).length > 0,
      carFilters: Object.keys(carQuery),
      carLookupMatch: JSON.stringify(carLookupMatch, (key, value) => {
        if (value instanceof mongoose.Types.ObjectId) {
          return value.toString();
        }
        if (value instanceof RegExp) {
          return value.toString();
        }
        return value;
      }, 2)
    });
    
    const carriers = await Carrier.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: "cars",
          let: { carrierId: "$_id" },
          pipeline: [
            {
              $match: carLookupMatch,
            },
          ],
          as: "cars",
        },
      },
      // Lookup user information for super admin to see who created each carrier
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
          totalAmount: {
            $sum: "$cars.amount",
          },
          // Get first user (should only be one) for easier access
          user: { $arrayElemAt: ["$user", 0] },
        },
      },
      {
        $addFields: {
          profit: {
            $subtract: ["$totalAmount", { $ifNull: ["$totalExpense", 0] }],
          },
        },
      },
      // When car filters (company, date) are applied, only show carriers that have matching cars
      // This ensures we only show carriers with cars matching the filter criteria
      ...(hasCarFilters ? [{ $match: { carCount: { $gt: 0 } } }] : []),
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
          notes: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          carCount: 1,
          totalAmount: 1,
          profit: 1,
          cars: 1, // Include cars for filtered display
          userId: 1, // Include userId
          user: { // Include user info for super admin
            username: 1,
            role: 1,
          },
        },
      },
    ]);

    console.log("🔍 Aggregation results:", {
      carriersFound: carriers.length,
      firstCarrier: carriers[0] ? {
        _id: carriers[0]._id?.toString(),
        userId: carriers[0].userId?.toString(),
        tripNumber: carriers[0].tripNumber,
        name: carriers[0].name,
        carCount: carriers[0].carCount,
        totalAmount: carriers[0].totalAmount,
        cars: carriers[0].cars?.map(c => ({
          companyName: c.companyName,
          amount: c.amount
        })) || []
      } : null,
      allCarrierUserIds: carriers.map(c => c.userId?.toString()).filter(Boolean),
      carCounts: carriers.map(c => ({
        tripNumber: c.tripNumber || c.name,
        carCount: c.carCount,
        totalAmount: c.totalAmount
      }))
    });

    // Get total count for pagination (use same logic as main match stage)
    const totalOtherConditions = {};
    
    // Copy all query conditions except userId and _id (we handle _id separately)
    Object.keys(query).forEach(key => {
      if (key !== 'userId' && key !== '_id' && query[key] !== undefined && query[key] !== null) {
        totalOtherConditions[key] = query[key];
      }
    });
    
    // Build total match stage (same unified logic as main match stage)
    // IMPORTANT: When car filters are applied, matchingCarrierIds MUST be used to restrict results
    let totalMatchStage;
    const totalMatchConditions = [];
    
    if (query.userId) {
      const userIdObj = query.userId instanceof mongoose.Types.ObjectId 
        ? query.userId 
        : new mongoose.Types.ObjectId(query.userId);
      
      // Always include userId filter for non-admin users
      totalMatchConditions.push({ userId: userIdObj });
    }
    
    // Add other conditions (date, type, etc.) - carrier-level filters
    if (Object.keys(totalOtherConditions).length > 0) {
      totalMatchConditions.push(totalOtherConditions);
    }
    
    // Add isActive filter if specified (handles $or for active trips)
    if (isActiveFilter) {
      totalMatchConditions.push(isActiveFilter);
    }
    
    // CRITICAL: If we have matching carrier IDs from car filters (company, car date, etc.),
    // we MUST restrict to only those carriers - this is the main filter
    // When car filters are applied, matchingCarrierIds MUST be set and used
    if (hasCarFilters) {
      if (!matchingCarrierIds || matchingCarrierIds.length === 0) {
        // This shouldn't happen - we should have returned empty earlier
        // But add safeguard: set a condition that matches nothing (impossible ObjectId)
        console.error("⚠️ ERROR: Car filters present but no matchingCarrierIds in total count - using empty filter");
        totalMatchConditions.push({ _id: { $in: [new mongoose.Types.ObjectId()] } }); // Will match nothing
      } else {
        // ALWAYS restrict to matching carriers when car filters are present
        totalMatchConditions.push({ _id: { $in: matchingCarrierIds } });
      }
    } else if (matchingCarrierIds && matchingCarrierIds.length > 0) {
      // This shouldn't happen (matchingCarrierIds should only be set when hasCarFilters is true)
      // But handle it just in case
      totalMatchConditions.push({ _id: { $in: matchingCarrierIds } });
    }
    
    // Combine all conditions
    if (totalMatchConditions.length === 0) {
      // No filters at all - show everything (shouldn't happen, but handle it)
      totalMatchStage = {};
    } else if (totalMatchConditions.length === 1) {
      totalMatchStage = totalMatchConditions[0];
    } else {
      // Multiple conditions - use $and
      totalMatchStage = { $and: totalMatchConditions };
    }
    
    console.log("🔍 Getting total count with matchStage:", JSON.stringify(totalMatchStage, null, 2));
    
    // Use the same car lookup match conditions for total count
    // This ensures consistent filtering between main query and count
    const totalCarriers = await Carrier.aggregate([
      { $match: totalMatchStage },
      {
        $lookup: {
          from: "cars",
          let: { carrierId: "$_id" },
          pipeline: [
            {
              $match: carLookupMatch,
            },
          ],
          as: "cars",
        },
      },
      // Don't filter - show all carriers
      // { $match: { $expr: { $gt: [{ $size: "$cars" }, 0] } } },
      { $count: "total" },
    ]);
    const total = totalCarriers[0]?.total || 0;
    console.log("🔍 Total carriers count:", total);
    const totalPages = Math.ceil(total / limit);

    // Convert ObjectIds to strings and format cars
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
    console.error("Error fetching carriers:", error);
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
    console.error("Error fetching carrier:", error);
    return { error: "Failed to fetch carrier" };
  }
}

export async function createCarrier(formData) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    const tripNumber = formData.get("tripNumber")?.trim();
    const name = formData.get("name")?.trim();
    const type = formData.get("type") || "trip";
    const date = formData.get("date");
    const totalExpense = parseFloat(formData.get("totalExpense") || "0");
    const notes = formData.get("notes")?.trim();
    
    // Super admin can select userId, regular users use their own
    const selectedUserId = formData.get("userId");
    let targetUserId = (session.role === "super_admin" && selectedUserId) 
      ? selectedUserId 
      : session.userId;
    
    // Convert userId to ObjectId if it's a valid string
    if (mongoose.Types.ObjectId.isValid(targetUserId)) {
      targetUserId = new mongoose.Types.ObjectId(targetUserId);
    }

    if (type === "trip" && !tripNumber) {
      return { error: "Trip number is required for trip-type carriers" };
    }


    // Check if already exists (for the target user) - show warning but allow duplicate
    let existingCarrier = null;
    let warning = null;
    if (type === "trip") {
      existingCarrier = await Carrier.findOne({ tripNumber, type: "trip", userId: targetUserId });
      if (existingCarrier) {
        warning = "Trip number already exists for this user";
      }
    } else {
      const upperName = name.trim().toUpperCase();
      existingCarrier = await Carrier.findOne({ name: upperName, type: "company", userId: targetUserId });
      if (existingCarrier) {
        warning = "Company name already exists for this user";
      }
    }

    // If exists, return it with warning (user can still proceed)
    if (existingCarrier && warning) {
      revalidatePath("/carriers");
      return {
        success: true,
        carrier: JSON.parse(JSON.stringify(existingCarrier)),
        message: type === "trip" ? "Carrier trip already exists" : "Company already exists",
        warning: warning,
      };
    }

    // Create new carrier
    const carrier = new Carrier({
      tripNumber: type === "trip" ? tripNumber : undefined,
      name: type === "company" ? name.trim().toUpperCase() : undefined,
      type,
      userId: targetUserId,
      date: date ? new Date(date) : new Date(),
      totalExpense: totalExpense || 0,
      notes: notes || "",
    });

    try {
      await carrier.save();
      revalidatePath("/carriers");

      return {
        success: true,
        carrier: JSON.parse(JSON.stringify(carrier)),
        message: type === "trip" ? "Carrier trip created successfully" : "Company created successfully",
        warning: warning || undefined,
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
          revalidatePath("/carriers");
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
    console.error("Error creating carrier:", error);
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

export async function updateCarrierExpense(carrierId, expense) {
  await connectDB();
  try {
    const carrier = await Carrier.findByIdAndUpdate(
      carrierId,
      { totalExpense: parseFloat(expense) || 0 },
      { new: true }
    ).lean();

    if (!carrier) {
      return { error: "Carrier not found" };
    }

    revalidatePath("/carriers");
    return {
      success: true,
      carrier: JSON.parse(JSON.stringify(carrier)),
    };
  } catch (error) {
    console.error("Error updating carrier expense:", error);
    return { error: "Failed to update expense" };
  }
}

export async function toggleCarrierActiveStatus(carrierId) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      console.error("Toggle active: No session found");
      return { error: "Unauthorized" };
    }

    // Convert carrierId to ObjectId if it's a string
    let carrierIdObj = carrierId;
    if (typeof carrierId === 'string' && mongoose.Types.ObjectId.isValid(carrierId)) {
      carrierIdObj = new mongoose.Types.ObjectId(carrierId);
    }

    const carrier = await Carrier.findById(carrierIdObj);
    if (!carrier) {
      console.error("Toggle active: Carrier not found", { carrierId, carrierIdObj });
      return { error: "Carrier not found" };
    }

    // Check if user has permission (must be owner or super admin)
    const carrierUserId = carrier.userId?.toString();
    const sessionUserId = session.userId?.toString();
    
    if (session.role !== "super_admin" && carrierUserId !== sessionUserId) {
      console.error("Toggle active: Unauthorized", { 
        carrierUserId, 
        sessionUserId, 
        role: session.role 
      });
      return { error: "Unauthorized to modify this carrier" };
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

    revalidatePath("/carriers");
    return {
      success: true,
      carrier: JSON.parse(JSON.stringify(carrier)),
      message: carrier.isActive ? "Trip marked as active" : "Trip marked as inactive",
    };
  } catch (error) {
    console.error("Error toggling carrier active status:", error);
    return { error: `Failed to update trip status: ${error.message}` };
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
        console.error("Invalid userId format:", session.userId);
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
    console.error("Error fetching filtered carriers:", error);
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