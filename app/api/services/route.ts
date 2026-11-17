
import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type { ResultSetHeader } from "mysql2";
import { authorizeRoles } from "@/lib/authorization";

export async function GET() {
  const authError = await authorizeRoles(["Admin", "Receptionist"]);
  if (authError) return authError;
  try {
    const [rows] = await pool.query(
      "SELECT * FROM SERVICE ORDER BY Service_ID"
    );

    return NextResponse.json({
      success: true,
      services: rows,
    });
  } catch (error) {
    console.error("Service fetch error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to fetch services",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authError = await authorizeRoles(["Admin", "Receptionist"]);
  if (authError) return authError;
  try {
    const body = await request.json();

    const {
      Service_Name,
      Description,
      Base_Price,
      Estimated_Duration,
    } = body;

    // Validate required fields
    if (
      !Service_Name?.trim() ||
      Base_Price === undefined ||
      Base_Price === null ||
      Base_Price === ""
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Service name and base price are required",
        },
        { status: 400 }
      );
    }

    // Validate price
    const price = Number(Base_Price);

    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Base price must be a valid non-negative number",
        },
        { status: 400 }
      );
    }

    // Validate duration if provided
    let duration = null;

    if (
      Estimated_Duration !== undefined &&
      Estimated_Duration !== null &&
      Estimated_Duration !== ""
    ) {
      duration = Number(Estimated_Duration);

      if (!Number.isInteger(duration) || duration <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Estimated duration must be a positive integer",
          },
          { status: 400 }
        );
      }
    }

    // Insert service
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO SERVICE
       (Service_Name, Description, Base_Price, Estimated_Duration)
       VALUES (?, ?, ?, ?)`,
      [
        Service_Name.trim(),
        Description?.trim() || null,
        price,
        duration,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Service added successfully",
        Service_ID: result.insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Service insert error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to add service" },
      { status: 500 }
    );
  }
}
