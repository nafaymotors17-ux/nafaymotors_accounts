"use server";

import { cookies } from "next/headers";
import connectDB from "@/app/lib/dbConnect";
import User from "@/app/lib/models/User";

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return Response.json(
        { success: false, error: "Username and password are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({ username: username.toLowerCase() });

    if (!user) {
      return Response.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Simple password check - no hashing
    if (user.password !== password) {
      return Response.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Return session data - client will store in localStorage
    const sessionData = {
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
    };

    return Response.json({
      success: true,
      user: sessionData,
      session: sessionData, // Include full session data for client
    });
  } catch (error) {
    console.error("Login error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
