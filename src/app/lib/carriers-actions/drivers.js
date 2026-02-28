"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import connectDB from "@/app/lib/dbConnect";
import Driver from "@/app/lib/models/Driver";
import { getSession } from "@/app/lib/auth/getSession";

export async function getAllDrivers(
  searchParams = {},
  sessionFromClient = null,
) {
  await connectDB();
  try {
    // Use session from client (localStorage) when passed - avoids cookie sync issues on Vercel
    const session = sessionFromClient || (await getSession());
    if (!session) {
      return { drivers: [] };
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
      const isActiveValue =
        searchParams.isActive === "true" || searchParams.isActive === true;
      if (isActiveValue) {
        query.$or = [
          { isActive: true },
          { isActive: { $exists: false } },
          { isActive: null },
        ];
      } else {
        query.isActive = false;
      }
    }

    // Search filter
    if (searchParams.search) {
      const searchTerm = decodeURIComponent(searchParams.search).trim();
      if (searchTerm) {
        const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const searchRegex = { $regex: escapedSearch, $options: "i" };
        query.$or = [
          { name: searchRegex },
          { phone: searchRegex },
          { email: searchRegex },
          { licenseNumber: searchRegex },
        ];
      }
    }

    const drivers = await Driver.find(query)
      .populate("userId", "username role")
      .sort({ name: 1 })
      .lean();

    const serialized = drivers.map((driver) => ({
      ...driver,
      _id: driver._id.toString(),
      userId: driver.userId?.toString() || driver.userId,
      user:
        driver.userId && typeof driver.userId === "object"
          ? {
              _id: driver.userId._id?.toString() || driver.userId._id,
              username: driver.userId.username,
              role: driver.userId.role,
            }
          : null,
    }));

    return {
      drivers: JSON.parse(JSON.stringify(serialized)),
    };
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return { drivers: [] };
  }
}

export async function getDriverById(driverId) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    const driver = await Driver.findById(driverId)
      .populate("userId", "username role")
      .lean();

    if (!driver) {
      return { error: "Driver not found" };
    }

    // Check permissions
    if (
      session.role !== "super_admin" &&
      driver.userId?.toString() !== session.userId
    ) {
      return { error: "Unauthorized" };
    }

    return {
      success: true,
      driver: JSON.parse(
        JSON.stringify({
          ...driver,
          _id: driver._id.toString(),
          userId: driver.userId?.toString() || driver.userId,
          user:
            driver.userId && typeof driver.userId === "object"
              ? {
                  _id: driver.userId._id?.toString() || driver.userId._id,
                  username: driver.userId.username,
                  role: driver.userId.role,
                }
              : null,
        }),
      ),
    };
  } catch (error) {
    console.error("Error fetching driver:", error);
    return { error: "Failed to fetch driver" };
  }
}

export async function createDriver(formData) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    const name = formData.get("name")?.trim();
    const phone = formData.get("phone")?.trim() || "";
    const email = formData.get("email")?.trim() || "";
    const licenseNumber = formData.get("licenseNumber")?.trim() || "";
    const address = formData.get("address")?.trim() || "";

    if (!name) {
      return { error: "Driver name is required" };
    }

    // Super admin can select userId, regular users use their own
    const selectedUserId = formData.get("userId");
    let targetUserId =
      session.role === "super_admin" && selectedUserId
        ? selectedUserId
        : session.userId;

    if (mongoose.Types.ObjectId.isValid(targetUserId)) {
      targetUserId = new mongoose.Types.ObjectId(targetUserId);
    }

    // Check if driver name already exists for this user
    const existingDriver = await Driver.findOne({
      name: name.trim(),
      userId: targetUserId,
    });

    if (existingDriver) {
      return {
        error: `Driver "${name}" already exists for this user. Please use a different name.`,
      };
    }

    const driver = new Driver({
      name: name.trim(),
      phone,
      email,
      licenseNumber,
      address,
      userId: targetUserId,
      isActive: true,
    });

    await driver.save();
    revalidatePath("/drivers");

    return {
      success: true,
      driver: JSON.parse(JSON.stringify(driver)),
    };
  } catch (error) {
    console.error("Error creating driver:", error);
    if (error.code === 11000) {
      return { error: "Driver with this name already exists for this user" };
    }
    return { error: "Failed to create driver" };
  }
}

export async function updateDriver(driverId, formData) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return { error: "Driver not found" };
    }

    // Check permissions
    if (
      session.role !== "super_admin" &&
      driver.userId.toString() !== session.userId
    ) {
      return { error: "Unauthorized" };
    }

    const name = formData.get("name")?.trim();
    const phone = formData.get("phone")?.trim() || "";
    const email = formData.get("email")?.trim() || "";
    const licenseNumber = formData.get("licenseNumber")?.trim() || "";
    const address = formData.get("address")?.trim() || "";

    if (!name) {
      return { error: "Driver name is required" };
    }

    // Check if new name conflicts with existing driver (for same user)
    if (name !== driver.name) {
      const existingDriver = await Driver.findOne({
        name: name.trim(),
        userId: driver.userId,
        _id: { $ne: driverId },
      });

      if (existingDriver) {
        return {
          error: `Driver "${name}" already exists for this user. Please use a different name.`,
        };
      }
    }

    driver.name = name.trim();
    driver.phone = phone;
    driver.email = email;
    driver.licenseNumber = licenseNumber;
    driver.address = address;

    await driver.save();
    revalidatePath("/drivers");

    return {
      success: true,
      driver: JSON.parse(JSON.stringify(driver)),
    };
  } catch (error) {
    console.error("Error updating driver:", error);
    if (error.code === 11000) {
      return { error: "Driver with this name already exists for this user" };
    }
    return { error: "Failed to update driver" };
  }
}

export async function deleteDriver(driverId) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return { error: "Driver not found" };
    }

    // Check permissions
    if (
      session.role !== "super_admin" &&
      driver.userId.toString() !== session.userId
    ) {
      return { error: "Unauthorized" };
    }

    // Check if driver is assigned to any trucks
    const Truck = (await import("@/app/lib/models/Truck")).default;
    const trucksWithDriver = await Truck.find({ drivers: driverId });

    if (trucksWithDriver.length > 0) {
      return {
        error: `Cannot delete driver. This driver is assigned to ${trucksWithDriver.length} truck(s). Please remove the driver from trucks first.`,
      };
    }

    await Driver.findByIdAndDelete(driverId);
    revalidatePath("/drivers");

    return {
      success: true,
      message: "Driver deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting driver:", error);
    return { error: "Failed to delete driver" };
  }
}
