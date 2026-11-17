
import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type { ResultSetHeader } from "mysql2";
import { authorizeRoles } from "@/lib/authorization";

export async function GET() {
  const authError = await authorizeRoles(["Admin", "Receptionist"]);
  if (authError) return authError;
  try {
    const [rows] = await pool.query(
      "SELECT * FROM MECHANIC ORDER BY Mechanic_ID"
    );

    return NextResponse.json({
      success: true,
      mechanics: rows,
    });
  } catch (error) {
    console.error("Mechanic fetch error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to fetch mechanics",
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
      First_Name,
      Last_Name,
      Phone,
      Specialization,
      Employment_Status,
    } = body;

    // Validate required fields
    if (!First_Name?.trim() || !Last_Name?.trim() || !Employment_Status) {
      return NextResponse.json(
        {
          success: false,
          message: "First name, last name and employment status are required",
        },
        { status: 400 }
      );
    }

    // Validate employment status
    const allowedStatuses = ["Active", "On Leave", "Resigned"];

    if (!allowedStatuses.includes(Employment_Status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid employment status",
        },
        { status: 400 }
      );
    }

    // Insert mechanic
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO MECHANIC
       (First_Name, Last_Name, Phone, Specialization, Employment_Status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        First_Name.trim(),
        Last_Name.trim(),
        Phone?.trim() || null,
        Specialization?.trim() || null,
        Employment_Status,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Mechanic added successfully",
        Mechanic_ID: result.insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Mechanic insert error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to add mechanic" },
      { status: 500 }
    );
  }
}
