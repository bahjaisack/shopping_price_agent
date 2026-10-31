import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";
import { getDatabase } from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (
      typeof query !== "string" ||
      !query.trim() ||
      query.length > 300
    ) {
      return NextResponse.json(
        { error: "Please provide a valid product search query." },
        { status: 400 },
      );
    }

    const searchId = crypto.randomUUID();

    await inngest.send({
      name: "shopping/search.requested",
      data: {
        query: query.trim(),
        searchId,
      },
    });

    return NextResponse.json({
      success: true,
      searchId,
      status: "processing",
      message: "Your product search has started.",
    });
  } catch (error) {
    console.error("Search request error:", error);

    return NextResponse.json(
      { error: "Unable to start product search." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchId = request.nextUrl.searchParams.get("id");

    if (!searchId) {
      return NextResponse.json(
        { error: "Search ID is required." },
        { status: 400 },
      );
    }

    const db = await getDatabase();

    const search = await db.collection("searches").findOne(
      { searchId },
      { projection: { _id: 0 } },
    );

    if (!search) {
      return NextResponse.json({
        success: true,
        status: "processing",
      });
    }

    return NextResponse.json({
      success: true,
      status: search.status,
      query: search.query,
      results: search.results ?? null,
    });
  } catch (error) {
    console.error("Search result error:", error);

    return NextResponse.json(
      { error: "Unable to retrieve search results." },
      { status: 500 },
    );
  }
}