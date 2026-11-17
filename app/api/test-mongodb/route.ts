
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;

    const db = client.db(
      process.env.MONGODB_DATABASE || "car_service_nosql"
    );

    const collections = await db.listCollections().toArray();

    return NextResponse.json({
      success: true,
      message: "MongoDB connected successfully!",
      database: db.databaseName,
      collections: collections.map((collection) => collection.name),
    });
  } catch (error) {
    console.error("MongoDB connection error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "MongoDB connection failed",
      },
      { status: 500 }
    );
  }
}
