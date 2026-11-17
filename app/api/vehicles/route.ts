
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

const staffRoles = ["Admin", "Receptionist"];

// GET: Staff see all vehicles; customers see only their own vehicles.
export async function GET() {
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
    const selectQuery = `
      SELECT
        v.Vehicle_ID,
        v.Customer_ID,
        v.Registration_Number,
        v.Manufacturer,
        v.Model,
        v.Manufacturing_Year,
        v.Fuel_Type,
        c.First_Name,
        c.Last_Name,
        c.Phone
      FROM VEHICLE v
      INNER JOIN CUSTOMER c
        ON v.Customer_ID = c.Customer_ID
    `;

    const [rows] = isStaff
      ? await pool.query<VehicleRow[]>(
          `${selectQuery} ORDER BY v.Vehicle_ID`
        )
      : await pool.execute<VehicleRow[]>(
          `${selectQuery} WHERE v.Customer_ID = ? ORDER BY v.Vehicle_ID`,
          [user.Customer_ID]
        );

    return NextResponse.json({
      success: true,
      vehicles: rows,
    });
  } catch (error) {
    console.error("Vehicle fetch error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch vehicles" },
      { status: 500 }
    );
  }
}

// POST: Staff can register for any customer.
// Customers can register vehicles only under their own profile.
export async function POST(request: Request) {
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
    const body = await request.json();

    const {
      Customer_ID,
      Registration_Number,
      Manufacturer,
      Model,
      Manufacturing_Year,
      Fuel_Type,
    } = body;

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
          message: "Customer, registration number, manufacturer and model are required",
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
      (!Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid manufacturing year" },
        { status: 400 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO VEHICLE
       (Customer_ID, Registration_Number, Manufacturer,
        Model, Manufacturing_Year, Fuel_Type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        ownerId,
        Registration_Number.trim(),
        Manufacturer.trim(),
        Model.trim(),
        year,
        Fuel_Type?.trim() || null,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Vehicle registered successfully",
        Vehicle_ID: result.insertId,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Vehicle insert error:", error);

    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;

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
      { success: false, message: "Unable to register vehicle" },
      { status: 500 }
    );
  }
}
