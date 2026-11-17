
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

interface RouteContext {
  params: {
    id: string;
  };
}

const staffRoles = ["Admin", "Receptionist"];

function getMySqlErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00`))
  );
}

function validTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)
  );
}

// GET: Staff can view any booking; customers can view their own.
export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
    );
  }

  const bookingId = Number(params.id);

  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid booking ID" },
      { status: 400 }
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
      WHERE b.Booking_ID = ?
    `;

    const [rows] = isStaff
      ? await pool.execute<BookingRow[]>(query, [bookingId])
      : await pool.execute<BookingRow[]>(
          `${query} AND v.Customer_ID = ?`,
          [bookingId, user.Customer_ID]
        );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Booking not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      booking: rows[0],
    });
  } catch (error) {
    console.error("Booking fetch error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch booking" },
      { status: 500 }
    );
  }
}

// PUT: Customers can edit appointment details of their own bookings.
// Only staff can change the vehicle or booking status.
export async function PUT(
  request: Request,
  { params }: RouteContext
) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
    );
  }

  const bookingId = Number(params.id);

  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid booking ID" },
      { status: 400 }
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
    const body = (await request.json()) as Record<string, unknown>;

    // Confirm that the booking exists and belongs to this customer, if applicable.
    const [bookings] = await pool.execute<BookingRow[]>(
      `SELECT
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
         v.Customer_ID,
         c.First_Name,
         c.Last_Name,
         c.Phone
       FROM BOOKING b
       INNER JOIN VEHICLE v
         ON b.Vehicle_ID = v.Vehicle_ID
       INNER JOIN CUSTOMER c
         ON v.Customer_ID = c.Customer_ID
       WHERE b.Booking_ID = ?`,
      [bookingId]
    );

    if (
      bookings.length === 0 ||
      (!isStaff && bookings[0].Customer_ID !== user.Customer_ID)
    ) {
      return NextResponse.json(
        { success: false, message: "Booking not found" },
        { status: 404 }
      );
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (isStaff && body.Vehicle_ID !== undefined) {
      const vehicleId = Number(body.Vehicle_ID);

      if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
        return NextResponse.json(
          { success: false, message: "Invalid vehicle ID" },
          { status: 400 }
        );
      }

      updates.push("Vehicle_ID = ?");
      values.push(vehicleId);
    }

    if (body.Appointment_Date !== undefined) {
      if (!validDate(body.Appointment_Date)) {
        return NextResponse.json(
          { success: false, message: "Invalid appointment date" },
          { status: 400 }
        );
      }

      updates.push("Appointment_Date = ?");
      values.push(body.Appointment_Date);
    }

    if (body.Appointment_Time !== undefined) {
      if (!validTime(body.Appointment_Time)) {
        return NextResponse.json(
          { success: false, message: "Invalid appointment time" },
          { status: 400 }
        );
      }

      updates.push("Appointment_Time = ?");
      values.push(body.Appointment_Time);
    }

    if (body.Problem_Description !== undefined) {
      if (
        body.Problem_Description !== null &&
        typeof body.Problem_Description !== "string"
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid problem description" },
          { status: 400 }
        );
      }

      updates.push("Problem_Description = ?");
      values.push(
        typeof body.Problem_Description === "string"
          ? body.Problem_Description.trim() || null
          : null
      );
    }

    if (isStaff && body.Booking_Status !== undefined) {
      if (
        typeof body.Booking_Status !== "string" ||
        !body.Booking_Status.trim()
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid booking status" },
          { status: 400 }
        );
      }

      updates.push("Booking_Status = ?");
      values.push(body.Booking_Status.trim());
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, message: "No valid fields provided for update" },
        { status: 400 }
      );
    }

    values.push(bookingId);

    const ownershipCondition = isStaff
      ? ""
      : ` AND EXISTS (
          SELECT 1
          FROM VEHICLE v
          WHERE v.Vehicle_ID = BOOKING.Vehicle_ID
            AND v.Customer_ID = ?
        )`;

    if (!isStaff) {
      values.push(user.Customer_ID as number);
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE BOOKING
       SET ${updates.join(", ")}
       WHERE Booking_ID = ?${ownershipCondition}`,
      values
    );

    if (result.affectedRows === 0) {
      // The row may be unchanged, so confirm it still exists.
      const [check] = await pool.execute<BookingRow[]>(
        `SELECT b.Booking_ID
         FROM BOOKING b
         INNER JOIN VEHICLE v ON b.Vehicle_ID = v.Vehicle_ID
         WHERE b.Booking_ID = ?
         ${isStaff ? "" : "AND v.Customer_ID = ?"}`,
        isStaff ? [bookingId] : [bookingId, user.Customer_ID]
      );

      if (check.length === 0) {
        return NextResponse.json(
          { success: false, message: "Booking not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Booking updated successfully",
    });
  } catch (error: unknown) {
    console.error("Booking update error:", error);

    const errorCode = getMySqlErrorCode(error);

    if (errorCode === "ER_NO_REFERENCED_ROW_2") {
      return NextResponse.json(
        { success: false, message: "Vehicle does not exist" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Unable to update booking" },
      { status: 500 }
    );
  }
}

// DELETE: Only Admin and Receptionist can delete bookings.
export async function DELETE(
  _request: Request,
  { params }: RouteContext
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
      { success: false, message: "Only Admin or Receptionist can delete bookings" },
      { status: 403 }
    );
  }

  const bookingId = Number(params.id);

  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid booking ID" },
      { status: 400 }
    );
  }

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM BOOKING WHERE Booking_ID = ?",
      [bookingId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "Booking not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Booking deleted successfully",
    });
  } catch (error) {
    console.error("Booking delete error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to delete booking. It may be linked to other records.",
      },
      { status: 500 }
    );
  }
}
