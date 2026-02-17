import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    // Clear the session cookie on the server side
    const cookieStore = await cookies();
    cookieStore.delete("user_session");
    
    const response = NextResponse.json({ success: true }, {
      headers: {
        "Set-Cookie": "user_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax"
      }
    });
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
