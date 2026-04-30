import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const testMode = process.env.TestModle === "true"
  return NextResponse.json({ testMode })
}
