"use server";

import { revalidatePath } from "next/cache";
import connectDB from "@/app/lib/dbConnect";
import User from "@/app/lib/models/User";
import { requireSuperAdmin, getSession } from "@/app/lib/auth/getSession";

export async function getAllUsers() {
  await connectDB();
  try {
    await requireSuperAdmin(); // Only super admin can view users
    
    const users = await User.find({})
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return {
      success: true,
      users: JSON.parse(JSON.stringify(users)),
    };
  } catch (error) {
    console.error("Error fetching users:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch users",
      users: [],
    };
  }
}

// Get all users for selection (used by super admin when creating trips/cars)
export async function getAllUsersForSelection() {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, users: [] };
    }

    // Only super admin can get users list
    if (session.role !== "super_admin") {
      return { success: false, users: [] };
    }
    
    const users = await User.find({})
      .select("_id username role")
      .sort({ username: 1 })
      .lean();

    return {
      success: true,
      users: JSON.parse(JSON.stringify(users)),
    };
  } catch (error) {
    console.error("Error fetching users:", error);
    return {
      success: false,
      users: [],
    };
  }
}

export async function createUser(formData) {
  await connectDB();
  try {
    await requireSuperAdmin(); // Only super admin can create users

    const username = formData.get("username")?.trim().toLowerCase();
    const password = formData.get("password");

    if (!username || !password) {
      return { success: false, error: "Username and password are required" };
    }

    // Check if user already exists
    const existing = await User.findOne({ username });
    if (existing) {
      return { success: false, error: "Username already exists" };
    }

    const user = new User({
      username,
      password, // Plain text
      role: "user",
    });

    await user.save();
    revalidatePath("/admin/users");

    return {
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
      },
    };
  } catch (error) {
    console.error("Error creating user:", error);
    return { success: false, error: "Failed to create user" };
  }
}

export async function deleteUser(userId) {
  await connectDB();
  try {
    await requireSuperAdmin(); // Only super admin can delete users

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return { success: false, error: "User not found" };
    }

    revalidatePath("/admin/users");
    return { success: true, message: "User deleted successfully" };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { success: false, error: "Failed to delete user" };
  }
}
