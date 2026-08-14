import { NextResponse } from "next/server";

// POST /api/auth/logout — 204 No Content
export async function POST() {
  return new NextResponse(null, { status: 204 });
}
