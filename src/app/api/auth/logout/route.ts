import { NextRequest, NextResponse } from "next/server";

// POST /api/auth/logout - Logout user
export async function POST(request: NextRequest) {
  try {
    // In a JWT-based system, logout is typically handled client-side
    // by removing the token from storage. This endpoint can be used
    // for any server-side cleanup if needed.
    
    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}