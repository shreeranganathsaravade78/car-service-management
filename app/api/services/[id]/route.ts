
import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { authorizeRoles } from "@/lib/authorization";

interface ServiceRow extends RowDataPacket {
  Service_ID: number;
  Service_Name: string;
  Description: string | null;
  Base_Price: number;
  Estimated_Duration: number | null;
}

function getMySqlErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

// GET: Fetch service by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authError = await authorizeRoles(["Admin", "Receptionist"]);
  if (authError) return authError;
  try {
    const serviceId = Number(params.id);

    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid service ID" },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute<ServiceRow[]>(
      "SELECT * FROM SERVICE WHERE Service_ID = ?",
      [serviceId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Service not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      service: rows[0],
    });
  } catch (error) {
    console.error("Service fetch error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch service" },
      { status: 500 }
    );
  }
}

// PUT: Update service
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authError = await authorizeRoles(["Admin", "Receptionist"]);
  if (authError) return authError;
  try {
    const serviceId = Number(params.id);

    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid service ID" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const {
      Service_Name,
      Description,
      Base_Price,
      Estimated_Duration,
    } = body;

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

    let duration: number | null = null;

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

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE SERVICE
       SET Service_Name = ?,
           Description = ?,
           Base_Price = ?,
           Estimated_Duration = ?
       WHERE Service_ID = ?`,
      [
        Service_Name.trim(),
        Description?.trim() || null,
        price,
        duration,
        serviceId,
      ]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "Service not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Service updated successfully",
      Service_ID: serviceId,
    });
  } catch (error) {
    console.error("Service update error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to update service" },
      { status: 500 }
    );
  }
}

// DELETE: Delete service
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authError = await authorizeRoles(["Admin", "Receptionist"]);
  if (authError) return authError;
  try {
    const serviceId = Number(params.id);

    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid service ID" },
        { status: 400 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM SERVICE WHERE Service_ID = ?",
      [serviceId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "Service not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Service deleted successfully",
      Service_ID: serviceId,
    });
  } catch (error: unknown) {
    console.error("Service delete error:", error);

    const errorCode = getMySqlErrorCode(error);

    if (errorCode === "ER_ROW_IS_REFERENCED_2") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Cannot delete service because it is associated with existing bookings.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Unable to delete service" },
      { status: 500 }
    );
  }
}
