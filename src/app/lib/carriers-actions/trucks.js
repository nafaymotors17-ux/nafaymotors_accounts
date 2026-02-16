"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import connectDB from "@/app/lib/dbConnect";
import Truck from "@/app/lib/models/Truck";
import { getSession } from "@/app/lib/auth/getSession";

export async function getAllTrucks(searchParams = {}, sessionFromClient = null) {
  await connectDB();
  try {
    // Use session from client (localStorage) when passed - avoids cookie sync issues on Vercel
    const session = sessionFromClient || (await getSession());
    if (!session) {
      return { trucks: [] };
    }

    // Build query
    const query = {};
    
    // Filter by userId - super admin can filter by any user, others use their own userId
    if (searchParams.userId && session.role === "super_admin") {
      if (mongoose.Types.ObjectId.isValid(searchParams.userId)) {
        query.userId = new mongoose.Types.ObjectId(searchParams.userId);
      }
    } else if (session.role !== "super_admin" && session.userId) {
      if (mongoose.Types.ObjectId.isValid(session.userId)) {
        query.userId = new mongoose.Types.ObjectId(session.userId);
      }
    }

    // Search filter
    if (searchParams.search) {
      const searchTerm = decodeURIComponent(searchParams.search).trim();
      if (searchTerm) {
        const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = { $regex: escapedSearch, $options: "i" };
        query.$or = [
          { name: searchRegex },
          { number: searchRegex }
        ];
      }
    }

    // Debug: Log the query being used
    console.log("getAllTrucks - Query:", JSON.stringify(query, null, 2));
    console.log("getAllTrucks - Session userId:", session.userId);
    console.log("getAllTrucks - Session role:", session.role);

    const trucks = await Truck.aggregate([
      // Match trucks based on query
      { $match: query },
      // Lookup drivers
      {
        $lookup: {
          from: "drivers",
          localField: "drivers",
          foreignField: "_id",
          as: "drivers",
        },
      },
      // Project only needed driver fields
      {
        $addFields: {
          drivers: {
            $map: {
              input: "$drivers",
              as: "driver",
              in: {
                _id: "$$driver._id",
                name: "$$driver.name",
                phone: "$$driver.phone",
                email: "$$driver.email",
                licenseNumber: "$$driver.licenseNumber",
              },
            },
          },
        },
      },
      // Lookup user
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      // Unwind user (should be single)
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Project final fields
      {
        $project: {
          _id: 1,
          name: 1,
          number: 1,
          drivers: 1,
          currentMeterReading: 1,
          maintenanceInterval: 1,
          lastMaintenanceKm: 1,
          lastMaintenanceDate: 1,
          userId: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          user: {
            _id: "$user._id",
            username: "$user.username",
            role: "$user.role",
          },
        },
      },
      // Sort by name
      { $sort: { name: 1 } },
    ]);

    // Debug: Log results
    console.log("getAllTrucks - Found trucks:", trucks.length);
    if (trucks.length > 0) {
      console.log("getAllTrucks - First truck sample:", JSON.stringify({
        _id: trucks[0]._id?.toString(),
        name: trucks[0].name,
        driversCount: trucks[0].drivers?.length || 0,
        drivers: trucks[0].drivers
      }, null, 2));
    }

    // Convert ObjectIds to strings
    const serialized = trucks.map(truck => {
      // Ensure drivers are properly formatted
      let drivers = [];
      if (truck.drivers && Array.isArray(truck.drivers) && truck.drivers.length > 0) {
        drivers = truck.drivers.map(d => {
          // Handle both populated and unpopulated driver objects
          if (d && typeof d === 'object') {
            return {
              _id: d._id?.toString() || d._id,
              name: d.name || 'Unknown',
              phone: d.phone || '',
              email: d.email || '',
              licenseNumber: d.licenseNumber || '',
            };
          }
          return null;
        }).filter(Boolean);
      }
      
      return {
        ...truck,
        _id: truck._id.toString(),
        userId: truck.userId?.toString() || truck.userId,
        drivers: drivers,
        user: truck.user ? {
          _id: truck.user._id.toString(),
          username: truck.user.username,
          role: truck.user.role,
        } : null,
      };
    });

    const result = {
      trucks: JSON.parse(JSON.stringify(serialized)),
    };
    
    // Debug: Log final result
    console.log("getAllTrucks - Returning trucks:", result.trucks.length);
    
    return result;
  } catch (error) {
    console.error("Error fetching trucks:", error);
    console.error("Error stack:", error.stack);
    return { trucks: [] };
  }
}

export async function getTruckById(truckId) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    if (!mongoose.Types.ObjectId.isValid(truckId)) {
      return { error: "Invalid truck ID" };
    }

    const truckObjectId = new mongoose.Types.ObjectId(truckId);
    
    const trucks = await Truck.aggregate([
      // Match specific truck
      { $match: { _id: truckObjectId } },
      // Lookup drivers
      {
        $lookup: {
          from: "drivers",
          localField: "drivers",
          foreignField: "_id",
          as: "drivers",
        },
      },
      // Project only needed driver fields
      {
        $addFields: {
          drivers: {
            $map: {
              input: "$drivers",
              as: "driver",
              in: {
                _id: "$$driver._id",
                name: "$$driver.name",
                phone: "$$driver.phone",
                email: "$$driver.email",
                licenseNumber: "$$driver.licenseNumber",
              },
            },
          },
        },
      },
      // Lookup user
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      // Unwind user (should be single)
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Project final fields
      {
        $project: {
          _id: 1,
          name: 1,
          number: 1,
          drivers: 1,
          currentMeterReading: 1,
          maintenanceInterval: 1,
          lastMaintenanceKm: 1,
          userId: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          user: {
            _id: "$user._id",
            username: "$user.username",
            role: "$user.role",
          },
        },
      },
    ]);

    if (!trucks || trucks.length === 0) {
      return { error: "Truck not found" };
    }

    const truck = trucks[0];

    // Check permissions
    if (session.role !== "super_admin" && truck.userId?.toString() !== session.userId) {
      return { error: "Unauthorized" };
    }

    // Convert ObjectIds to strings
    return {
      success: true,
      truck: JSON.parse(JSON.stringify({
        ...truck,
        _id: truck._id.toString(),
        userId: truck.userId?.toString() || truck.userId,
        drivers: (truck.drivers || []).map(d => ({
          _id: d._id.toString(),
          name: d.name,
          phone: d.phone,
          email: d.email,
          licenseNumber: d.licenseNumber,
        })),
        user: truck.user ? {
          _id: truck.user._id.toString(),
          username: truck.user.username,
          role: truck.user.role,
        } : null,
      })),
    };
  } catch (error) {
    console.error("Error fetching truck:", error);
    return { error: "Failed to fetch truck" };
  }
}

export async function createTruck(formData) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    const name = formData.get("name")?.trim();
    const driverIds = formData.getAll("driverIds"); // Get all selected driver IDs
    console.log("createTruck - driverIds received:", driverIds);
    const number = formData.get("number")?.trim() || "";
    const currentMeterReading = parseFloat(formData.get("currentMeterReading") || "0") || 0;
    const maintenanceInterval = parseFloat(formData.get("maintenanceInterval") || "1000") || 1000;
    const lastMaintenanceKm = parseFloat(formData.get("lastMaintenanceKm") || "0") || 0;

    if (!name) {
      return { error: "Truck name is required" };
    }

    if (!driverIds || driverIds.length === 0) {
      return { error: "At least one driver is required" };
    }

    // Super admin can select userId, regular users use their own
    const selectedUserId = formData.get("userId");
    let targetUserId = (session.role === "super_admin" && selectedUserId) 
      ? selectedUserId 
      : session.userId;
    
    if (mongoose.Types.ObjectId.isValid(targetUserId)) {
      targetUserId = new mongoose.Types.ObjectId(targetUserId);
    }

    // Check if truck name already exists for this user
    const existingTruck = await Truck.findOne({ 
      name: name.trim().toUpperCase(),
      userId: targetUserId
    });

    if (existingTruck) {
      return { 
        error: `Truck "${name}" already exists for this user. Please use a different name.` 
      };
    }

    // Validate all drivers
    const Driver = (await import("@/app/lib/models/Driver")).default;
    const driverObjectIds = [];
    
    for (const driverId of driverIds) {
      if (!driverId || !driverId.trim()) continue;
      
      if (mongoose.Types.ObjectId.isValid(driverId)) {
        const driverObjectId = new mongoose.Types.ObjectId(driverId);
        const driver = await Driver.findById(driverObjectId);
        if (!driver) {
          return { error: `Driver with ID ${driverId} not found` };
        }
        if (session.role !== "super_admin" && driver.userId.toString() !== targetUserId.toString()) {
          return { error: `Driver "${driver.name}" does not belong to this user` };
        }
        driverObjectIds.push(driverObjectId);
      } else {
        return { error: `Invalid driver ID: ${driverId}` };
      }
    }

    if (driverObjectIds.length === 0) {
      return { error: "At least one valid driver is required" };
    }

    const truck = new Truck({
      name: name.trim().toUpperCase(),
      drivers: driverObjectIds,
      number: number.trim().toUpperCase(),
      currentMeterReading,
      maintenanceInterval,
      lastMaintenanceKm,
      userId: targetUserId,
      isActive: true,
    });

    console.log("createTruck - Saving truck:", {
      name: truck.name,
      userId: truck.userId?.toString(),
      driversCount: truck.drivers?.length || 0,
      driverIds: truck.drivers?.map(d => d.toString())
    });

    await truck.save();
    
    console.log("createTruck - Truck saved successfully:", {
      _id: truck._id?.toString(),
      name: truck.name,
      userId: truck.userId?.toString()
    });
    
    revalidatePath("/carriers");

    return {
      success: true,
      truck: JSON.parse(JSON.stringify(truck)),
    };
  } catch (error) {
    console.error("Error creating truck:", error);
    if (error.code === 11000) {
      return { error: "Truck with this name already exists for this user" };
    }
    return { error: "Failed to create truck" };
  }
}

export async function updateTruck(truckId, formData) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    const truck = await Truck.findById(truckId);
    if (!truck) {
      return { error: "Truck not found" };
    }

    // Check permissions
    if (session.role !== "super_admin" && truck.userId.toString() !== session.userId) {
      return { error: "Unauthorized" };
    }

    const name = formData.get("name")?.trim();
    const newDriverIds = formData.getAll("newDriverIds"); // Get new drivers to add
    const number = formData.get("number")?.trim() || "";
    const currentMeterReading = parseFloat(formData.get("currentMeterReading") || "0") || 0;
    const maintenanceInterval = parseFloat(formData.get("maintenanceInterval") || "1000") || 1000;
    const lastMaintenanceKm = parseFloat(formData.get("lastMaintenanceKm") || "0") || 0;
    const lastMaintenanceDate = formData.get("lastMaintenanceDate") ? new Date(formData.get("lastMaintenanceDate")) : undefined;

    if (!name) {
      return { error: "Truck name is required" };
    }

    // Check if new name conflicts with existing truck (for same user)
    if (name.toUpperCase() !== truck.name) {
      const existingTruck = await Truck.findOne({
        name: name.trim().toUpperCase(),
        userId: truck.userId,
        _id: { $ne: truckId }
      });

      if (existingTruck) {
        return { 
          error: `Truck "${name}" already exists for this user. Please use a different name.` 
        };
      }
    }

    // Get existing driver IDs (keep them - they cannot be removed)
    const existingDriverIds = (truck.drivers || []).map(d => d.toString());

    // Validate and process new drivers to add
    if (newDriverIds && newDriverIds.length > 0) {
      const Driver = (await import("@/app/lib/models/Driver")).default;
      const newDriverObjectIds = [];
      
      for (const driverId of newDriverIds) {
        if (!driverId || !driverId.trim()) continue;
        
        // Skip if driver is already assigned
        if (existingDriverIds.includes(driverId)) {
          continue;
        }
        
        if (mongoose.Types.ObjectId.isValid(driverId)) {
          const driverObjectId = new mongoose.Types.ObjectId(driverId);
          const driver = await Driver.findById(driverObjectId);
          if (!driver) {
            return { error: `Driver with ID ${driverId} not found` };
          }
          if (session.role !== "super_admin" && driver.userId.toString() !== truck.userId.toString()) {
            return { error: `Driver "${driver.name}" does not belong to this user` };
          }
          newDriverObjectIds.push(driverObjectId);
        } else {
          return { error: `Invalid driver ID: ${driverId}` };
        }
      }

      // Combine existing drivers with new ones (avoid duplicates)
      const allDriverIds = [
        ...existingDriverIds.map(id => new mongoose.Types.ObjectId(id)),
        ...newDriverObjectIds
      ];
      
      // Remove duplicates
      const uniqueDriverIds = [...new Set(allDriverIds.map(id => id.toString()))]
        .map(id => new mongoose.Types.ObjectId(id));
      
      truck.drivers = uniqueDriverIds;
    }
    // If no new drivers provided, keep existing drivers (they are locked)

    // Update other fields
    truck.name = name.trim().toUpperCase();
    truck.number = number.trim().toUpperCase();
    truck.currentMeterReading = currentMeterReading;
    truck.maintenanceInterval = maintenanceInterval;
    truck.lastMaintenanceKm = lastMaintenanceKm;
    // Update lastMaintenanceDate if provided
    if (lastMaintenanceDate) {
      truck.lastMaintenanceDate = lastMaintenanceDate;
    }

    await truck.save();
    revalidatePath("/carriers");

    return {
      success: true,
      truck: JSON.parse(JSON.stringify(truck)),
    };
  } catch (error) {
    console.error("Error updating truck:", error);
    if (error.code === 11000) {
      return { error: "Truck with this name already exists for this user" };
    }
    return { error: "Failed to update truck" };
  }
}

export async function deleteTruck(truckId) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    const truck = await Truck.findById(truckId);
    if (!truck) {
      return { error: "Truck not found" };
    }

    // Check permissions
    if (session.role !== "super_admin" && truck.userId.toString() !== session.userId) {
      return { error: "Unauthorized" };
    }

    // Check if truck is assigned to any trips
    const Carrier = (await import("@/app/lib/models/Carrier")).default;
    const tripsWithTruck = await Carrier.find({ truck: truckId });
    
    if (tripsWithTruck.length > 0) {
      return { 
        error: `Cannot delete truck. This truck is assigned to ${tripsWithTruck.length} trip(s). Please remove the truck from trips first.` 
      };
    }

    await Truck.findByIdAndDelete(truckId);
    revalidatePath("/carriers");

    return {
      success: true,
      message: "Truck deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting truck:", error);
    return { error: "Failed to delete truck" };
  }
}
