"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import connectDB from "@/app/lib/dbConnect";
import Truck from "@/app/lib/models/Truck";
import { getSession } from "@/app/lib/auth/getSession";

export async function getAllTrucks(searchParams = {}) {
  await connectDB();
  try {
    const session = await getSession();
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

    // Filter by active status
    if (searchParams.isActive !== undefined && searchParams.isActive !== "") {
      const isActiveValue = searchParams.isActive === "true" || searchParams.isActive === true;
      if (isActiveValue) {
        query.$or = [
          { isActive: true },
          { isActive: { $exists: false } },
          { isActive: null }
        ];
      } else {
        query.isActive = false;
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

    const trucks = await Truck.find(query)
      .populate("driver", "name phone email licenseNumber")
      .populate("userId", "username role")
      .sort({ name: 1 })
      .lean();

    const serialized = trucks.map(truck => ({
      ...truck,
      _id: truck._id.toString(),
      userId: truck.userId?.toString() || truck.userId,
      driver: truck.driver ? {
        _id: truck.driver._id?.toString() || truck.driver._id,
        name: truck.driver.name,
        phone: truck.driver.phone,
        email: truck.driver.email,
        licenseNumber: truck.driver.licenseNumber,
      } : null,
      user: truck.userId && typeof truck.userId === 'object' ? {
        _id: truck.userId._id?.toString() || truck.userId._id,
        username: truck.userId.username,
        role: truck.userId.role
      } : null,
    }));

    return {
      trucks: JSON.parse(JSON.stringify(serialized)),
    };
  } catch (error) {
    console.error("Error fetching trucks:", error);
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

    const truck = await Truck.findById(truckId)
      .populate("driver", "name phone email licenseNumber")
      .populate("userId", "username role")
      .lean();

    if (!truck) {
      return { error: "Truck not found" };
    }

    // Check permissions
    if (session.role !== "super_admin" && truck.userId?.toString() !== session.userId) {
      return { error: "Unauthorized" };
    }

    return {
      success: true,
      truck: JSON.parse(JSON.stringify({
        ...truck,
        _id: truck._id.toString(),
        userId: truck.userId?.toString() || truck.userId,
        driver: truck.driver ? {
          _id: truck.driver._id?.toString() || truck.driver._id,
          name: truck.driver.name,
          phone: truck.driver.phone,
          email: truck.driver.email,
          licenseNumber: truck.driver.licenseNumber,
        } : null,
        user: truck.userId && typeof truck.userId === 'object' ? {
          _id: truck.userId._id?.toString() || truck.userId._id,
          username: truck.userId.username,
          role: truck.userId.role
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
    const driverId = formData.get("driverId")?.trim() || "";
    const number = formData.get("number")?.trim() || "";
    const currentMeterReading = parseFloat(formData.get("currentMeterReading") || "0") || 0;
    const totalKms = parseFloat(formData.get("totalKms") || "0") || 0;
    const maintenanceInterval = parseFloat(formData.get("maintenanceInterval") || "1000") || 1000;
    const lastMaintenanceKm = parseFloat(formData.get("lastMaintenanceKm") || "0") || 0;

    if (!name) {
      return { error: "Truck name is required" };
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

    // Validate driver if provided
    let driverObjectId = null;
    if (driverId) {
      if (mongoose.Types.ObjectId.isValid(driverId)) {
        driverObjectId = new mongoose.Types.ObjectId(driverId);
        // Verify driver exists and belongs to the same user (or super admin can use any)
        const Driver = (await import("@/app/lib/models/Driver")).default;
        const driver = await Driver.findById(driverObjectId);
        if (!driver) {
          return { error: "Selected driver not found" };
        }
        if (session.role !== "super_admin" && driver.userId.toString() !== targetUserId.toString()) {
          return { error: "Selected driver does not belong to this user" };
        }
      } else {
        return { error: "Invalid driver ID" };
      }
    }

    const truck = new Truck({
      name: name.trim().toUpperCase(),
      driver: driverObjectId,
      number: number.trim().toUpperCase(),
      currentMeterReading,
      totalKms,
      maintenanceInterval,
      lastMaintenanceKm,
      userId: targetUserId,
      isActive: true,
    });

    await truck.save();
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
    const driverId = formData.get("driverId")?.trim() || "";
    const number = formData.get("number")?.trim() || "";
    const currentMeterReading = parseFloat(formData.get("currentMeterReading") || "0") || 0;
    const totalKms = parseFloat(formData.get("totalKms") || "0") || 0;
    const maintenanceInterval = parseFloat(formData.get("maintenanceInterval") || "1000") || 1000;
    const lastMaintenanceKm = parseFloat(formData.get("lastMaintenanceKm") || "0") || 0;
    const isActive = formData.get("isActive") === "true" || formData.get("isActive") === true;

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

    // Validate driver if provided
    let driverObjectId = null;
    if (driverId) {
      if (mongoose.Types.ObjectId.isValid(driverId)) {
        driverObjectId = new mongoose.Types.ObjectId(driverId);
        // Verify driver exists and belongs to the same user (or super admin can use any)
        const Driver = (await import("@/app/lib/models/Driver")).default;
        const driver = await Driver.findById(driverObjectId);
        if (!driver) {
          return { error: "Selected driver not found" };
        }
        if (session.role !== "super_admin" && driver.userId.toString() !== truck.userId.toString()) {
          return { error: "Selected driver does not belong to this user" };
        }
      } else {
        return { error: "Invalid driver ID" };
      }
    }

    truck.name = name.trim().toUpperCase();
    truck.driver = driverObjectId;
    truck.number = number.trim().toUpperCase();
    truck.currentMeterReading = currentMeterReading;
    truck.totalKms = totalKms;
    truck.maintenanceInterval = maintenanceInterval;
    truck.lastMaintenanceKm = lastMaintenanceKm;
    truck.isActive = isActive;

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
