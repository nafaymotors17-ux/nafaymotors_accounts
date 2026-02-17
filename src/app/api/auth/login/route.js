import { NextResponse } from "next/server";
import connectDB from "@/app/lib/dbConnect";
import User from "@/app/lib/models/User";

// Match client: 24 hours
const SESSION_MAX_AGE_SEC = 60 * 60 * 24;

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Username and password are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({ username: username.toLowerCase() });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (user.password !== password) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const sessionData = {
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
    };

    const res = NextResponse.json({
      success: true,
      user: sessionData,
      session: sessionData,
    });

    // Set session cookie from server so Vercel gets it immediately (avoids cookie sync timing)
    const cookieValue = encodeURIComponent(JSON.stringify(sessionData));
    const secure = process.env.VERCEL || process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.headers.set(
      "Set-Cookie",
      `user_session=${cookieValue}; Path=/; Max-Age=${SESSION_MAX_AGE_SEC}; SameSite=Lax${secure}`
    );

    return res;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
