"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import connectDB from "@/app/lib/dbConnect";
import Carrier from "@/app/lib/models/Carrier";
import Car from "@/app/lib/models/Car";
import Expense from "@/app/lib/models/Expense";
import Driver from "@/app/lib/models/Driver";
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
    
    // Filter by trip number (supports comma-separated values)
    if (searchParams.tripNumber) {
      const tripNumberFilter = decodeURIComponent(searchParams.tripNumber).trim();
      if (tripNumberFilter) {
        // Split by comma and trim each trip number
        const tripNumbers = tripNumberFilter.split(',').map(tn => tn.trim()).filter(tn => tn);
        if (tripNumbers.length > 0) {
          // Use regex for single trip number, $or for multiple
          if (tripNumbers.length === 1) {
            const escapedTripNumber = tripNumbers[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            carrierMatchConditions.push({ tripNumber: { $regex: escapedTripNumber, $options: "i" } });
          } else {
            // For multiple trip numbers, use $or with regex for each
            carrierMatchConditions.push({
              $or: tripNumbers.map(tn => {
                const escaped = tn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return { tripNumber: { $regex: escaped, $options: "i" } };
              })
            });
          }
        }
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
            { tripNumber: searchRegex },
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
              $lookup: {
                from: "trucks",
                localField: "truck",
                foreignField: "_id",
                as: "truckData",
              },
            },
            {
              $unwind: {
                path: "$truckData",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $lookup: {
                from: "drivers",
                localField: "truckData.drivers",
                foreignField: "_id",
                as: "truckData.drivers",
              },
            },
            {
              $project: {
                tripNumber: 1,
                name: 1,
                type: 1,
                date: 1,
                totalExpense: 1,
                truck: 1,
                truckData: {
                  _id: 1,
                  name: 1,
                  number: 1,
                  drivers: {
                    _id: 1,
                    name: 1,
                  },
                },
                carrierName: 1,
                driverName: 1,
                details: 1,
                notes: 1,
                distance: 1,
                meterReadingAtTrip: 1,
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
          // Totals pipeline - calculate aggregations on all matching carriers
          totals: [
            {
              $group: {
                _id: null,
                totalCars: { $sum: "$carCount" },
                totalAmount: { $sum: "$totalAmount" },
                totalExpenses: { $sum: { $ifNull: ["$totalExpense", 0] } },
                totalTrips: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                totalCars: { $ifNull: ["$totalCars", 0] },
                totalAmount: { $ifNull: ["$totalAmount", 0] },
                totalExpenses: { $ifNull: ["$totalExpenses", 0] },
                totalProfit: { $subtract: ["$totalAmount", { $ifNull: ["$totalExpenses", 0] }] },
                totalTrips: { $ifNull: ["$totalTrips", 0] },
              },
            },
          ],
        },
      },
    ]);

    const carriers = result.results || [];
    const total = result.total[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);
    const totals = result.totals[0] || {
      totalCars: 0,
      totalAmount: 0,
      totalExpenses: 0,
      totalProfit: 0,
      totalTrips: 0,
    };

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
      totals: {
        totalCars: totals.totalCars || 0,
        totalAmount: totals.totalAmount || 0,
        totalExpenses: totals.totalExpenses || 0,
        totalProfit: totals.totalProfit || 0,
        totalTrips: totals.totalTrips || 0,
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

export async function getTripByTripNumber(tripNumber) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    // Build query - super admin can see all trips, others only their own
    const query = {
      tripNumber: tripNumber.trim().toUpperCase(),
      type: "trip",
    };

    if (session.role !== "super_admin" && session.userId) {
      if (mongoose.Types.ObjectId.isValid(session.userId)) {
        query.userId = new mongoose.Types.ObjectId(session.userId);
      }
    }

    const carrier = await Carrier.findOne(query).lean();
    if (!carrier) {
      return { error: "Trip not found" };
    }

    const carQuery = { carrier: carrier._id };
    
    // Filter by location if user is not super admin
    if (session && session.role !== "super_admin" && session.location) {
      carQuery.location = session.location;
    }
    
    const cars = await Car.find(carQuery)
      .populate("carrier", "tripNumber name type date totalExpense carrierName driverName details notes")
      .sort({ date: 1 })
      .lean();

    const totalAmount = cars.reduce((sum, car) => sum + (car.amount || 0), 0);
    const profit = totalAmount - (carrier.totalExpense || 0);

    return {
      success: true,
      carrier: JSON.parse(JSON.stringify(carrier)),
      cars: JSON.parse(JSON.stringify(cars)),
      totalAmount,
      profit,
    };
  } catch (error) {
    console.error("Error fetching trip by trip number:", error);
    return { error: "Failed to fetch trip" };
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
    const truckId = formData.get("truck")?.trim() || "";
    const tripDistance = parseFloat(formData.get("tripDistance") || "0");
    // Legacy fields for backward compatibility
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

    // Validate truck if provided
    let truckObjectId = null;
    let truck = null;
    if (truckId) {
      if (mongoose.Types.ObjectId.isValid(truckId)) {
        truckObjectId = new mongoose.Types.ObjectId(truckId);
        // Verify truck exists
        const Truck = (await import("@/app/lib/models/Truck")).default;
        truck = await Truck.findById(truckObjectId);
        if (!truck) {
          return { error: "Selected truck not found" };
        }
        // Check permissions - user must own the truck or be super admin
        if (session.role !== "super_admin" && truck.userId.toString() !== targetUserId.toString()) {
          return { error: "Selected truck does not belong to this user" };
        }
      } else {
        return { error: "Invalid truck ID" };
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
      truck: truckObjectId,
      distance: tripDistance > 0 ? tripDistance : undefined,
      // Capture truck's current meter reading at the time of trip creation
      meterReadingAtTrip: truck && truck.currentMeterReading ? truck.currentMeterReading : undefined,
      // Legacy fields for backward compatibility
      carrierName: carrierName || "",
      driverName: driverName || "",
      details: details || "",
      notes: notes || "",
      isActive: true, // Newly created trips are active by default
    });

    try {
      await carrier.save();
      
      // Update truck meter if trip distance is provided
      if (truck && tripDistance > 0) {
        const Truck = (await import("@/app/lib/models/Truck")).default;
        const updatedTruck = await Truck.findByIdAndUpdate(
          truck._id,
          {
            $inc: { 
              currentMeterReading: tripDistance
            }
          },
          { new: true }
        );
        
        // Check if maintenance is needed and store warning if exceeded
        const nextMaintenanceKm = (updatedTruck.lastMaintenanceKm || 0) + (updatedTruck.maintenanceInterval || 1000);
        const newKm = updatedTruck.currentMeterReading;
        const kmsRemaining = nextMaintenanceKm - newKm;
        
        if (kmsRemaining <= 0) {
          // Maintenance overdue - store this info
          await Truck.findByIdAndUpdate(truck._id, {
            $set: {
              maintenanceWarning: `Maintenance overdue! Current: ${newKm}km, Next required: ${nextMaintenanceKm}km`
            }
          });
          console.warn(`Truck ${truck.name} maintenance is overdue! Current: ${newKm}km, Last maintenance: ${updatedTruck.lastMaintenanceKm}km`);
        } else if (kmsRemaining <= 500) {
          // Maintenance due soon
          await Truck.findByIdAndUpdate(truck._id, {
            $set: {
              maintenanceWarning: `Maintenance due soon! ${kmsRemaining}km remaining until ${nextMaintenanceKm}km`
            }
          });
          console.warn(`Truck ${truck.name} maintenance due soon! ${kmsRemaining}km remaining`);
        } else {
          // Clear warning if all good
          await Truck.findByIdAndUpdate(truck._id, {
            $unset: { maintenanceWarning: "" }
          });
        }
      }
      
      revalidatePath("/carrier-trips");
      revalidatePath("/carriers");

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
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    const truckId = formData.get("truck")?.trim() || "";
    const tripDistance = parseFloat(formData.get("tripDistance") || "0");
    // Legacy fields for backward compatibility
    const carrierName = formData.get("carrierName")?.trim() || "";
    const driverName = formData.get("driverName")?.trim() || "";
    const details = formData.get("details")?.trim() || "";
    const notes = formData.get("notes")?.trim() || "";
    const tripNumber = formData.get("tripNumber")?.trim();
    
    // Get carrier first to check permissions and type
    const carrier = await Carrier.findById(carrierId);
    if (!carrier) {
      return { error: "Carrier not found" };
    }

    // Check if user has permission to update this carrier
    if (session.role !== "super_admin" && carrier.userId.toString() !== session.userId) {
      return { error: "Unauthorized" };
    }

    // Calculate totalExpense from individual expenses
    const expenses = await Expense.find({ carrier: carrierId });
    const totalExpense = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // Validate truck if provided
    let truckObjectId = null;
    let truck = null;
    const oldTruckId = carrier.truck?.toString() || carrier.truck || null;
    const oldDistance = carrier.distance || 0;
    
    // Only update truck if a new truck ID is provided (not empty string)
    if (truckId && truckId.trim() !== "") {
      if (mongoose.Types.ObjectId.isValid(truckId)) {
        truckObjectId = new mongoose.Types.ObjectId(truckId);
        // Verify truck exists
        const Truck = (await import("@/app/lib/models/Truck")).default;
        truck = await Truck.findById(truckObjectId);
        if (!truck) {
          return { error: "Selected truck not found" };
        }
        // Check permissions - user must own the truck or be super admin
        if (session.role !== "super_admin" && truck.userId.toString() !== carrier.userId.toString()) {
          return { error: "Selected truck does not belong to this user" };
        }
      } else {
        return { error: "Invalid truck ID" };
      }
    } else {
      // If no truck ID provided, keep the existing truck
      if (oldTruckId) {
        truckObjectId = new mongoose.Types.ObjectId(oldTruckId);
        const Truck = (await import("@/app/lib/models/Truck")).default;
        truck = await Truck.findById(truckObjectId);
      }
    }

    const updateData = {
      totalExpense,
      // Only update truck if a new one was provided
      ...(truckObjectId ? { truck: truckObjectId } : {}),
      // Always update distance if provided (even if 0, to allow clearing it)
      ...(tripDistance !== undefined && tripDistance !== null ? { distance: tripDistance } : {}),
      // Legacy fields for backward compatibility
      carrierName,
      driverName,
      details,
      notes,
    };
    
    // Update trip number if provided and it's a trip-type carrier
    if (carrier.type === "trip" && tripNumber) {
      const newTripNumber = tripNumber.trim().toUpperCase();
      
      // Check if the new trip number is different from current
      if (newTripNumber !== carrier.tripNumber) {
        // Check if new trip number already exists (for the same user)
        const existingCarrier = await Carrier.findOne({
          tripNumber: newTripNumber,
          type: "trip",
          userId: carrier.userId,
          _id: { $ne: carrierId } // Exclude current carrier
        });
        
        if (existingCarrier) {
          return {
            error: `Trip number "${newTripNumber}" already exists. Please use a different trip number.`
          };
        }
        
        updateData.tripNumber = newTripNumber;
      }
    }
    
    // Update meterReadingAtTrip if:
    // 1. It's not set and truck is assigned, OR
    // 2. Truck has changed (new truck assigned)
    const truckChanged = oldTruckId && truckObjectId && oldTruckId.toString() !== truckObjectId.toString();
    if (truck && truck.currentMeterReading) {
      if (!carrier.meterReadingAtTrip || truckChanged) {
        updateData.meterReadingAtTrip = truck.currentMeterReading;
      }
    }

    const updatedCarrier = await Carrier.findByIdAndUpdate(
      carrierId,
      { $set: updateData },
      { new: true }
    ).lean();

    if (!updatedCarrier) {
      return { error: "Carrier not found" };
    }

    // Update truck meter if trip distance is provided and truck is assigned
    // Need to handle the difference between old and new distance
    if (truck && tripDistance !== undefined && tripDistance !== null) {
      const Truck = (await import("@/app/lib/models/Truck")).default;
      
      // Calculate the difference: new distance - old distance
      const distanceDifference = tripDistance - oldDistance;
      
      // Only update if there's a change in distance
      if (distanceDifference !== 0) {
        const updatedTruck = await Truck.findByIdAndUpdate(
          truck._id,
          {
            $inc: { 
              currentMeterReading: distanceDifference
            }
          },
          { new: true }
        );
        
        // Check if maintenance is needed and store warning if exceeded
        const nextMaintenanceKm = (updatedTruck.lastMaintenanceKm || 0) + (updatedTruck.maintenanceInterval || 1000);
        const newKm = updatedTruck.currentMeterReading;
        const kmsRemaining = nextMaintenanceKm - newKm;
        
        if (kmsRemaining <= 0) {
          // Maintenance overdue - store this info
          await Truck.findByIdAndUpdate(truck._id, {
            $set: {
              maintenanceWarning: `Maintenance overdue! Current: ${newKm}km, Next required: ${nextMaintenanceKm}km`
            }
          });
          console.warn(`Truck ${truck.name} maintenance is overdue! Current: ${newKm}km, Last maintenance: ${updatedTruck.lastMaintenanceKm}km`);
        } else if (kmsRemaining <= 500) {
          // Maintenance due soon
          await Truck.findByIdAndUpdate(truck._id, {
            $set: {
              maintenanceWarning: `Maintenance due soon! ${kmsRemaining}km remaining until ${nextMaintenanceKm}km`
            }
          });
          console.warn(`Truck ${truck.name} maintenance due soon! ${kmsRemaining}km remaining`);
        } else {
          // Clear warning if all good
          await Truck.findByIdAndUpdate(truck._id, {
            $unset: { maintenanceWarning: "" }
          });
        }
      }
    }

    revalidatePath("/carriers");
    revalidatePath("/carrier-trips");
    revalidatePath("/carrier-trips");
    return {
      success: true,
      carrier: JSON.parse(JSON.stringify(updatedCarrier)),
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
    
    // Company filter - search by companyName (exact match only)
    if (searchParams.company) {
      const escapedCompany = searchParams.company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      carQuery.companyName = { $regex: `^${escapedCompany}$`, $options: "i" };
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