"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import connectDB from "@/app/lib/dbConnect";
import Car from "@/app/lib/models/Car";
import Carrier from "@/app/lib/models/Carrier";
import { getSession } from "@/app/lib/auth/getSession";

export async function getCarsByCarrier(carrierId) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { cars: [] };
    }

    // Convert carrierId to ObjectId if it's a string
    let carrierObjectId = carrierId;
    if (typeof carrierId === 'string' && mongoose.Types.ObjectId.isValid(carrierId)) {
      carrierObjectId = new mongoose.Types.ObjectId(carrierId);
    } else if (!mongoose.Types.ObjectId.isValid(carrierId)) {
      console.error(`[getCarsByCarrier] Invalid carrierId: ${carrierId}`);
      return { cars: [] };
    }

    const query = { carrier: carrierObjectId };
    
    // Filter by userId if user is not super admin
    if (session.role !== "super_admin") {
      const userObjectId = mongoose.Types.ObjectId.isValid(session.userId) 
        ? new mongoose.Types.ObjectId(session.userId)
        : session.userId;
      query.userId = userObjectId;
    }

    console.log(`[getCarsByCarrier] Query for carrier ${carrierId}:`, JSON.stringify(query));

    const cars = await Car.find(query)
      .populate("carrier", "tripNumber name type date totalExpense")
      .sort({ date: 1, createdAt: 1 })
      .lean();

    console.log(`[getCarsByCarrier] Found ${cars.length} cars for carrier ${carrierId}`);

    return {
      cars: JSON.parse(JSON.stringify(cars)),
    };
  } catch (error) {
    console.error("Error fetching cars:", error);
    return { cars: [] };
  }
}

export async function getFilteredCars(filters = {}) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { cars: [], totalAmount: 0, count: 0 };
    }

    const query = {};

    // Filter by userId if user is not super admin
    if (session.role !== "super_admin") {
      query.userId = session.userId;
    }

    // Date filter
    if (filters.startDate && filters.endDate) {
      const startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      
      query.date = {
        $gte: startDate,
        $lte: endDate,
      };
    } else if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
      query.date = { $gte: startDate };
    } else if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      query.date = { $lte: endDate };
    }

    // Company filter - search by companyName
    if (filters.company) {
      query.companyName = { $regex: filters.company, $options: "i" };
    }

    // Carrier filter
    if (filters.carrierId) {
      query.carrier = filters.carrierId;
    }

    const cars = await Car.find(query)
      .populate("carrier", "tripNumber name type date totalExpense")
      .sort({ date: 1, createdAt: 1 })
      .lean();

    // Calculate totals
    const totalAmount = cars.reduce((sum, car) => sum + (car.amount || 0), 0);

    return {
      cars: JSON.parse(JSON.stringify(cars)),
      totalAmount,
      count: cars.length,
    };
  } catch (error) {
    console.error("Error fetching filtered cars:", error);
    return { cars: [], totalAmount: 0, count: 0 };
  }
}

export async function createCar(formData) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    const stockNo = formData.get("stockNo")?.trim();
    const name = formData.get("name")?.trim();
    const chassis = formData.get("chassis")?.trim();
    const amount = parseFloat(formData.get("amount") || "0");
    const companyName = formData.get("companyName")?.trim();
    const carrierId = formData.get("carrierId");
    const date = formData.get("date");

    const selectedUserId = formData.get("userId");
    const targetUserId = (session.role === "super_admin" && selectedUserId) 
      ? selectedUserId 
      : session.userId;
    
    if (!stockNo || !name || !chassis || !companyName || !carrierId) {
      console.error(`[createCar] Missing required fields:`, { stockNo, name, chassis, companyName, carrierId });
      return { error: "Required fields are missing" };
    }

    // Convert carrierId to ObjectId if it's a string
    let tripCarrierId = carrierId;
    if (typeof carrierId === 'string' && mongoose.Types.ObjectId.isValid(carrierId)) {
      tripCarrierId = new mongoose.Types.ObjectId(carrierId);
    } else if (!mongoose.Types.ObjectId.isValid(carrierId)) {
      console.error(`[createCar] Invalid carrierId format: ${carrierId}`);
      return { error: "Invalid trip/carrier ID" };
    }

    const car = await new Car({
      stockNo,
      name,
      chassis,
      amount: amount || 0,
      companyName:  companyName.trim().toUpperCase(),
      userId: targetUserId,
      carrier: carrierId, // This is the trip carrier (must be type='trip')
      date: date ? new Date(date) : new Date(),
    });

    await car.save();
    revalidatePath("/carrier-trips");

    return {
      success: true,
      car: JSON.parse(JSON.stringify(car)),
      message: "Car added successfully",
    };
  } catch (error) {
    console.error("Error creating car:", error);
    return { error: "Failed to add car" };
  }
}

export async function createMultipleCars(carsData, carrierId, selectedUserId = null) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    // Super admin can select userId, regular users use their own
    const targetUserId = (session.role === "super_admin" && selectedUserId) 
      ? selectedUserId 
      : session.userId;

    const results = [];
    
    for (const carData of carsData) {
      const { stockNo, name, chassis, amount, companyName, date } = carData;
      
      if (!stockNo || !name || !chassis || !companyName) {
        continue;
      }



      const car = new Car({
        stockNo: stockNo.trim(),
        name: name.trim(),
        chassis: chassis.trim(),
        amount: parseFloat(amount) || 0,
        companyName: companyName,
        userId: targetUserId,
        carrier: carrierId, 
        date: date ? new Date(date) : new Date(),
      });

      await car.save();
      results.push(car);
    }

    revalidatePath("/carrier-trips");

    return {
      success: true,
      cars: JSON.parse(JSON.stringify(results)),
      message: `${results.length} car(s) added successfully`,
    };
  } catch (error) {
    console.error("Error creating multiple cars:", error);
    return { error: "Failed to add cars" };
  }
}

export async function deleteCar(carId) {
  await connectDB();
  try {
    const car = await Car.findByIdAndDelete(carId);
    if (!car) {
      return { error: "Car not found" };
    }

    revalidatePath("/carrier-trips");
    return { success: true, message: "Car deleted successfully" };
  } catch (error) {
    console.error("Error deleting car:", error);
    return { error: "Failed to delete car" };
  }
}

export async function getCarsByCompany(filters = {}) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized", cars: [], groupedCars: {}, totalAmount: 0, count: 0 };
    }

    const {
      companyId,
      companyName,
      startDate,
      endDate,
      carrierIds,
      isActive, // Filter by active/inactive trips
      groupBy = "none", // "none", "carrier", "month"
    } = filters;

    const query = {};

    // Filter by userId if user is not super admin
    if (session.role !== "super_admin") {
      query.userId = session.userId;
    }

    // Company filter (required) - search by companyName or find company-type carrier
    if (companyId) {
      // If companyId is provided, it's actually a carrier ID (company-type)
      query.carrier = companyId;
    } else if (companyName) {
      // Search for company-type carrier by name
      const companyCarrier = await Carrier.findOne({
        name: { $regex: companyName, $options: "i" },
        type: 'company'
      });
      if (companyCarrier) {
        // For company invoices, we want all cars with this company name
        query.companyName = { $regex: companyName, $options: "i" };
      } else {
        // Fallback to companyName field
        query.companyName = { $regex: companyName, $options: "i" };
      }
    } else {
      return { error: "Company ID or name is required" };
    }

    // Date filter
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

    // Carrier filter
    if (carrierIds && Array.isArray(carrierIds) && carrierIds.length > 0) {
      query.carrier = { $in: carrierIds };
    }

    // First, get all cars matching the basic filters
    let cars = await Car.find(query)
      .populate("carrier", "tripNumber name type date totalExpense isActive")
      .sort({ date: 1, createdAt: 1 })
      .lean();

    // Filter by active/inactive trips if specified
    if (isActive !== undefined && isActive !== null && isActive !== "") {
      const isActiveValue = isActive === "true" || isActive === true;
      cars = cars.filter(car => {
        // If carrier is populated, check its isActive status
        if (car.carrier && car.carrier.isActive !== undefined) {
          // For active: include isActive=true OR isActive is undefined/null (backward compatibility)
          if (isActiveValue) {
            return car.carrier.isActive !== false;
          } else {
            // For inactive: only include isActive=false
            return car.carrier.isActive === false;
          }
        }
        // If carrier is not populated or doesn't have isActive, treat as active for backward compatibility
        return isActiveValue;
      });
    }

    // Group cars based on groupBy option
    let groupedCars = {};
    let totalAmount = 0;

    if (groupBy === "carrier") {
      // Group by carrier
      cars.forEach((car) => {
        const carrierId = car.carrier?._id?.toString() || "unknown";
        if (!groupedCars[carrierId]) {
          groupedCars[carrierId] = {
            carrier: car.carrier,
            cars: [],
            totalAmount: 0,
          };
        }
        groupedCars[carrierId].cars.push(car);
        groupedCars[carrierId].totalAmount += car.amount || 0;
        totalAmount += car.amount || 0;
      });
    } else if (groupBy === "month") {
      // Group by month
      cars.forEach((car) => {
        const date = new Date(car.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (!groupedCars[monthKey]) {
          groupedCars[monthKey] = {
            month: monthKey,
            monthName: date.toLocaleString("en-US", { month: "long", year: "numeric" }),
            cars: [],
            totalAmount: 0,
          };
        }
        groupedCars[monthKey].cars.push(car);
        groupedCars[monthKey].totalAmount += car.amount || 0;
        totalAmount += car.amount || 0;
      });
    } else {
      // No grouping - return all cars in a single group
      totalAmount = cars.reduce((sum, car) => sum + (car.amount || 0), 0);
      groupedCars = {
        all: {
          cars,
          totalAmount,
        },
      };
    }

    return {
      success: true,
      cars: JSON.parse(JSON.stringify(cars)),
      groupedCars: JSON.parse(JSON.stringify(groupedCars)),
      totalAmount,
      count: cars.length,
      groupBy,
    };
  } catch (error) {
    console.error("Error fetching cars by company:", error);
    return {
      success: false,
      error: "Failed to fetch cars",
      cars: [],
      groupedCars: {},
      totalAmount: 0,
      count: 0,
    };
  }
}