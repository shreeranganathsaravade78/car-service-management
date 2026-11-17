
import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface BookingRow extends RowDataPacket {
  Booking_ID: number;
  Vehicle_ID: number;
  Booking_Date: Date | string;
  Appointment_Date: Date | string;
  Appointment_Time: string;
  Problem_Description: string | null;
  Booking_Status: string;
  Registration_Number: string;
  Manufacturer: string;
  Model: string;
  Customer_ID: number;
  First_Name: string;
  Last_Name: string;
  Phone: string;
}

interface VehicleOwnerRow extends RowDataPacket {
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

// GET: Staff see all bookings; customers see only their own bookings.
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
    const query = `
      SELECT
        b.Booking_ID,
        b.Vehicle_ID,
        b.Booking_Date,
        b.Appointment_Date,
        b.Appointment_Time,
        b.Problem_Description,
        b.Booking_Status,
        v.Registration_Number,
        v.Manufacturer,
        v.Model,
        c.Customer_ID,
        c.First_Name,
        c.Last_Name,
        c.Phone
      FROM BOOKING b
      INNER JOIN VEHICLE v
        ON b.Vehicle_ID = v.Vehicle_ID
      INNER JOIN CUSTOMER c
        ON v.Customer_ID = c.Customer_ID
    `;

    const [rows] = isStaff
      ? await pool.query<BookingRow[]>(
          `${query} ORDER BY b.Booking_ID`
        )
      : await pool.execute<BookingRow[]>(
          `${query}
           WHERE v.Customer_ID = ?
           ORDER BY b.Booking_ID`,
          [user.Customer_ID]
        );

    return NextResponse.json({
      success: true,
      bookings: rows,
    });
  } catch (error) {
    console.error("Booking fetch error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch bookings" },
      { status: 500 }
    );
  }
}

// POST: Staff can book any vehicle; customers can book only their own vehicles.
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
      Vehicle_ID,
      Appointment_Date,
      Appointment_Time,
      Problem_Description,
    } = body;

    const vehicleId = Number(Vehicle_ID);

    if (
      !Number.isInteger(vehicleId) ||
      vehicleId <= 0 ||
      !Appointment_Date ||
      !Appointment_Time
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Vehicle ID, appointment date and appointment time are required",
        },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(Appointment_Date)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid appointment date format. Use YYYY-MM-DD",
        },
        { status: 400 }
      );
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(Appointment_Time)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid appointment time format. Use HH:MM or HH:MM:SS",
        },
        { status: 400 }
      );
    }

    // Verify vehicle ownership for customer accounts.
    if (!isStaff) {
      const [vehicles] = await pool.execute<VehicleOwnerRow[]>(
        `SELECT Vehicle_ID
         FROM VEHICLE
         WHERE Vehicle_ID = ? AND Customer_ID = ?`,
        [vehicleId, user.Customer_ID]
      );

      if (vehicles.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "You can only create bookings for your own vehicles",
          },
          { status: 403 }
        );
      }
    }

    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO BOOKING
       (Vehicle_ID, Booking_Date, Appointment_Date,
        Appointment_Time, Problem_Description, Booking_Status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        vehicleId,
        today,
        Appointment_Date,
        Appointment_Time,
        typeof Problem_Description === "string"
          ? Problem_Description.trim() || null
          : null,
        "Pending",
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Booking created successfully",
        Booking_ID: result.insertId,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Booking insert error:", error);

    const errorCode = getMySqlErrorCode(error);

    if (errorCode === "ER_NO_REFERENCED_ROW_2") {
      return NextResponse.json(
        { success: false, message: "Vehicle does not exist" },
        { status: 400 }
      );
    }

    if (errorCode === "ER_CHECK_CONSTRAINT_VIOLATED") {
      return NextResponse.json(
        {
          success: false,
          message: "Appointment date must be on or after booking date",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Unable to create booking" },
      { status: 500 }
    );
  }
}
