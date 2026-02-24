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
      .select("_id username name role address bankDetails createdAt updatedAt")
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
      .select("_id username name role address bankDetails")
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

// Get current user details
export async function getCurrentUser() {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const user = await User.findById(session.userId)
      .select("_id username name role address bankDetails")
      .lean();

    if (!user) {
      return { success: false, error: "User not found" };
    }

    return {
      success: true,
      user: JSON.parse(JSON.stringify(user)),
    };
  } catch (error) {
    console.error("Error fetching current user:", error);
    return { success: false, error: "Failed to fetch user" };
  }
}

export async function createUser(formData) {
  await connectDB();
  try {
    await requireSuperAdmin(); // Only super admin can create users

    const username = formData.get("username")?.trim().toLowerCase();
    const name = formData.get("name")?.trim() || "";
    const password = formData.get("password");
    const address = formData.get("address")?.trim() || "";
    const bankDetails = formData.get("bankDetails")?.trim() || "";

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
      name,
      password, // Plain text
      role: "user",
      address,
      bankDetails,
    });

    await user.save();
    revalidatePath("/admin/users");

    return {
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        name: user.name,
        role: user.role,
        address: user.address,
        bankDetails: user.bankDetails,
      },
    };
  } catch (error) {
    console.error("Error creating user:", error);
    if (error.code === 11000) {
      return { success: false, error: "Username already exists" };
    }
    return { success: false, error: "Failed to create user" };
  }
}

export async function updateUser(userId, formData) {
  await connectDB();

  try {
    await requireSuperAdmin();

    const username = formData.get("username")?.trim().toLowerCase();
    const name = formData.get("name")?.trim() || "";
    const password = formData.get("password");
    const address = formData.get("address")?.trim() || "";
    const bankDetails = formData.get("bankDetails")?.trim() || "";

    if (!username) {
      return { success: false, error: "Username is required" };
    }

    const existingUser = await User.findOne({
      username,
      _id: { $ne: userId },
    });

    if (existingUser) {
      return { success: false, error: "Username already exists" };
    }

    const updateData = {
      username,
      name,
      address,
      bankDetails,
    };

    // Only update password if provided
    if (password && password.trim() !== "") {
      updateData.password = password;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true } // 👈 IMPORTANT
    );

    if (!updatedUser) {
      return { success: false, error: "Failed to update user" };
    }

    console.log("[updateUser] Updated user:", updatedUser);

    revalidatePath("/admin/users");

    return {
      success: true,
      user: {
        id: updatedUser._id.toString(),
        username: updatedUser.username,
        name: updatedUser.name,
        role: updatedUser.role,
        address: updatedUser.address || "",
        bankDetails: updatedUser.bankDetails || "",
      },
    };
  } catch (error) {
    console.error("[updateUser] Error updating user:", error);
    return {
      success: false,
      error: error.message || "Failed to update user",
    };
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
    return { success: false, error: error.message || "Failed to delete user" };
  }
}

/** Update current user's own profile (username, name, address, bankDetails, optional password). */
export async function updateOwnProfile(formData) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session?.userId) {
      return { success: false, error: "Unauthorized" };
    }
    const userId = session.userId;
    const username = formData.get("username")?.trim().toLowerCase();
    const name = formData.get("name")?.trim() || "";
    const password = formData.get("password");
    const address = formData.get("address")?.trim() || "";
    const bankDetails = formData.get("bankDetails")?.trim() || "";
    if (!username) {
      return { success: false, error: "Username is required" };
    }
    const existingUser = await User.findOne({ username, _id: { $ne: userId } });
    if (existingUser) {
      return { success: false, error: "Username already exists" };
    }
    const updateData = { username, name, address, bankDetails };
    if (password && password.trim() !== "") {
      updateData.password = password.trim();
    }
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true })
      .select("_id username name role address bankDetails")
      .lean();
    if (!updatedUser) {
      return { success: false, error: "User not found" };
    }
    revalidatePath("/profile");
    revalidatePath("/admin/users");
    return { success: true, user: JSON.parse(JSON.stringify(updatedUser)) };
  } catch (error) {
    console.error("Error updating profile:", error);
    return { success: false, error: error.message || "Failed to update profile" };
  }
}
