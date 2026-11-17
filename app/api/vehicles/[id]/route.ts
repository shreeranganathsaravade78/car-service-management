
import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface VehicleRow extends RowDataPacket {
  Vehicle_ID: number;
  Customer_ID: number;
  Registration_Number: string;
  Manufacturer: string;
  Model: string;
  Manufacturing_Year: number | null;
  Fuel_Type: string | null;
  First_Name: string;
  Last_Name: string;
  Phone: string;
}

interface VehicleIdRow extends RowDataPacket {
  Vehicle_ID: number;
}

const staffRoles = ["Admin", "Receptionist"];

function getMySqlErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

// GET: Staff can view any vehicle.
// Customer can view only their own vehicle.
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
    );
  }

  const isStaff = user.Roles.some((role) => staffRoles.includes(role));
  const isCustomer = user.Roles.includes("Customer");

  if (!isStaff && !isCustomer) {
    return NextResponse.json(
      { success: false, message: "You do not have permission" },
      { status: 403 }
    );
  }

  if (isCustomer && !isStaff && user.Customer_ID === null) {
    return NextResponse.json(
      { success: false, message: "Your account is not linked to a customer profile" },
      { status: 403 }
    );
  }

  try {
    const vehicleId = Number(params.id);

    if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid vehicle ID" },
        { status: 400 }
      );
    }

    const query = `
      SELECT
        v.*,
        c.First_Name,
        c.Last_Name,
        c.Phone
      FROM VEHICLE v
      INNER JOIN CUSTOMER c
        ON v.Customer_ID = c.Customer_ID
      WHERE v.Vehicle_ID = ?
    `;

    const [rows] = isStaff
      ? await pool.execute<VehicleRow[]>(query, [vehicleId])
      : await pool.execute<VehicleRow[]>(
          `${query} AND v.Customer_ID = ?`,
          [vehicleId, user.Customer_ID]
        );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Vehicle not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      vehicle: rows[0],
    });
  } catch (error) {
    console.error("Vehicle fetch error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch vehicle" },
      { status: 500 }
    );
  }
}

// PUT: Staff can update any vehicle.
// Customer can update only their own vehicle.
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
    );
  }

  const isStaff = user.Roles.some((role) => staffRoles.includes(role));
  const isCustomer = user.Roles.includes("Customer");

  if (!isStaff && !isCustomer) {
    return NextResponse.json(
      { success: false, message: "You do not have permission" },
      { status: 403 }
    );
  }

  if (isCustomer && !isStaff && user.Customer_ID === null) {
    return NextResponse.json(
      { success: false, message: "Your account is not linked to a customer profile" },
      { status: 403 }
    );
  }

  try {
    const vehicleId = Number(params.id);

    if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid vehicle ID" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const {
      Customer_ID,
      Registration_Number,
      Manufacturer,
      Model,
      Manufacturing_Year,
      Fuel_Type,
    } = body;

    // Customers cannot change their vehicle's owner.
    const ownerId = isStaff ? Customer_ID : user.Customer_ID;

    if (
      !Number.isInteger(ownerId) ||
      ownerId <= 0 ||
      !Registration_Number?.trim() ||
      !Manufacturer?.trim() ||
      !Model?.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Valid customer ID, registration number, manufacturer and model are required",
        },
        { status: 400 }
      );
    }

    const year =
      Manufacturing_Year === undefined ||
      Manufacturing_Year === null ||
      Manufacturing_Year === ""
        ? null
        : Number(Manufacturing_Year);

    if (
      year !== null &&
      (!Number.isInteger(year) ||
        year < 1886 ||
        year > new Date().getFullYear() + 1)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid manufacturing year" },
        { status: 400 }
      );
    }

    // Verify vehicle ownership before updating.
    const [existing] = isStaff
      ? await pool.execute<VehicleIdRow[]>(
          "SELECT Vehicle_ID FROM VEHICLE WHERE Vehicle_ID = ?",
          [vehicleId]
        )
      : await pool.execute<VehicleIdRow[]>(
          `SELECT Vehicle_ID FROM VEHICLE
           WHERE Vehicle_ID = ? AND Customer_ID = ?`,
          [vehicleId, user.Customer_ID]
        );

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, message: "Vehicle not found" },
        { status: 404 }
      );
    }

    await pool.execute<ResultSetHeader>(
      `UPDATE VEHICLE
       SET Customer_ID = ?,
           Registration_Number = ?,
           Manufacturer = ?,
           Model = ?,
           Manufacturing_Year = ?,
           Fuel_Type = ?
       WHERE Vehicle_ID = ?`,
      [
        ownerId,
        Registration_Number.trim(),
        Manufacturer.trim(),
        Model.trim(),
        year,
        Fuel_Type?.trim() || null,
        vehicleId,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "Vehicle updated successfully",
      Vehicle_ID: vehicleId,
    });
  } catch (error: unknown) {
    console.error("Vehicle update error:", error);

    const errorCode = getMySqlErrorCode(error);

    if (errorCode === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { success: false, message: "Registration number already exists" },
        { status: 409 }
      );
    }

    if (errorCode === "ER_NO_REFERENCED_ROW_2") {
      return NextResponse.json(
        { success: false, message: "Customer does not exist" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Unable to update vehicle" },
      { status: 500 }
    );
  }
}

// DELETE: Only Admin and Receptionist can delete vehicles.
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
    );
  }

  const isStaff = user.Roles.some((role) => staffRoles.includes(role));

  if (!isStaff) {
    return NextResponse.json(
      { success: false, message: "You do not have permission to delete vehicles" },
      { status: 403 }
    );
  }

  try {
    const vehicleId = Number(params.id);

    if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid vehicle ID" },
        { status: 400 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM VEHICLE WHERE Vehicle_ID = ?",
      [vehicleId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "Vehicle not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Vehicle deleted successfully",
      Vehicle_ID: vehicleId,
    });
  } catch (error: unknown) {
    console.error("Vehicle delete error:", error);

    const errorCode = getMySqlErrorCode(error);

    if (errorCode === "ER_ROW_IS_REFERENCED_2") {
      return NextResponse.json(
        {
          success: false,
          message: "Cannot delete vehicle because related bookings exist.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Unable to delete vehicle" },
      { status: 500 }
    );
  }
}
