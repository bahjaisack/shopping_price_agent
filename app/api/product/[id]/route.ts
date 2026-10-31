import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid comparison ID." },
        { status: 400 }
      );
    }

    const db = await getDatabase();

    const comparison = await db.collection("searches").findOne({
      _id: new ObjectId(id),
    });

    if (!comparison) {
      return NextResponse.json(
        { success: false, error: "Comparison not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      comparison: {
        ...comparison,
        _id: comparison._id.toString(),
      },
    });
  } catch (error) {
    console.error("Product retrieval error:", error);

    return NextResponse.json(
      { success: false, error: "Failed to retrieve comparison." },
      { status: 500 }
    );
  }
}
