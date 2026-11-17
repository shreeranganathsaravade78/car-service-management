
import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { authorizeRoles } from "@/lib/authorization";

interface MechanicRow extends RowDataPacket {
  Mechanic_ID: number;
  First_Name: string;
  Last_Name: string;
  Phone: string | null;
  Specialization: string | null;
  Employment_Status: string;
}

function getMySqlErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

// GET: Fetch mechanic by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authError = await authorizeRoles(["Admin", "Receptionist"]);
  if (authError) return authError;
  try {
    const mechanicId = Number(params.id);

    if (!Number.isInteger(mechanicId) || mechanicId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid mechanic ID" },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute<MechanicRow[]>(
      "SELECT * FROM MECHANIC WHERE Mechanic_ID = ?",
      [mechanicId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Mechanic not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      mechanic: rows[0],
    });
  } catch (error) {
    console.error("Mechanic fetch error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch mechanic" },
      { status: 500 }
    );
  }
}

// PUT: Update mechanic
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authError = await authorizeRoles(["Admin", "Receptionist"]);
  if (authError) return authError;
  try {
    const mechanicId = Number(params.id);

    if (!Number.isInteger(mechanicId) || mechanicId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid mechanic ID" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const {
      First_Name,
      Last_Name,
      Phone,
      Specialization,
      Employment_Status,
    } = body;

    if (
      !First_Name?.trim() ||
      !Last_Name?.trim() ||
      !Employment_Status
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "First name, last name and employment status are required",
        },
        { status: 400 }
      );
    }

    const allowedStatuses = ["Active", "On Leave", "Resigned"];

    if (!allowedStatuses.includes(Employment_Status)) {
      return NextResponse.json(
        { success: false, message: "Invalid employment status" },
        { status: 400 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE MECHANIC
       SET First_Name = ?,
           Last_Name = ?,
           Phone = ?,
           Specialization = ?,
           Employment_Status = ?
       WHERE Mechanic_ID = ?`,
      [
        First_Name.trim(),
        Last_Name.trim(),
        Phone?.trim() || null,
        Specialization?.trim() || null,
        Employment_Status,
        mechanicId,
      ]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "Mechanic not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Mechanic updated successfully",
      Mechanic_ID: mechanicId,
    });
  } catch (error) {
    console.error("Mechanic update error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to update mechanic" },
      { status: 500 }
    );
  }
}

// DELETE: Delete mechanic
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authError = await authorizeRoles(["Admin", "Receptionist"]);
  if (authError) return authError;
  try {
    const mechanicId = Number(params.id);

    if (!Number.isInteger(mechanicId) || mechanicId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid mechanic ID" },
        { status: 400 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM MECHANIC WHERE Mechanic_ID = ?",
      [mechanicId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "Mechanic not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Mechanic deleted successfully",
      Mechanic_ID: mechanicId,
    });
  } catch (error: unknown) {
    console.error("Mechanic delete error:", error);

    const errorCode = getMySqlErrorCode(error);

    if (errorCode === "ER_ROW_IS_REFERENCED_2") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Cannot delete mechanic because existing bookings are assigned to this mechanic.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Unable to delete mechanic" },
      { status: 500 }
    );
  }
}
