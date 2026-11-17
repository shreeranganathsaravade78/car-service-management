
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import pool from "@/lib/mysql";
import type { RowDataPacket } from "mysql2";
import { getSessionUser } from "@/lib/session";
import { authorizeRoles } from "@/lib/authorization";
import { z } from "zod";
import type { Document } from "mongodb";

const diagnosticSchema = z.object({
  vehicle_id: z.number().int().positive(),
  booking_id: z.number().int().positive(),
  diagnostic_date: z.coerce.date().optional(),
  engine_temperature: z.number().nonnegative(),
  battery_voltage: z.number().nonnegative(),
  oil_level: z.string().trim().min(1),
  brake_condition: z.string().trim().min(1),
  alerts: z.array(z.string().trim()).default([]),
  overall_status: z.string().trim().min(1),
});

interface VehicleIdRow extends RowDataPacket {
  Vehicle_ID: number;
}

interface BookingVehicleRow extends RowDataPacket {
  Booking_ID: number;
  Vehicle_ID: number;
}

// GET: Staff and mechanics see all diagnostics.
// Customers see diagnostics for their own vehicles only.
export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
    );
  }

  const canViewAll = user.Roles.some((role) =>
    ["Admin", "Receptionist", "Mechanic"].includes(role)
  );

  const isCustomer = user.Roles.includes("Customer");

  if (!canViewAll && !isCustomer) {
    return NextResponse.json(
      { success: false, message: "You do not have permission" },
      { status: 403 }
    );
  }

  if (!canViewAll && user.Customer_ID === null) {
    return NextResponse.json(
      {
        success: false,
        message: "Your account is not linked to a customer profile",
      },
      { status: 403 }
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db(
      process.env.MONGODB_DATABASE || "car_service_nosql"
    );

    let diagnostics: Document[];

    if (canViewAll) {
      diagnostics = await db
        .collection("vehicle_diagnostics")
        .find({})
        .sort({ diagnostic_date: -1 })
        .toArray();
    } else {
      // Get only the vehicle IDs belonging to this customer.
      const [vehicles] = await pool.execute<VehicleIdRow[]>(
        `SELECT Vehicle_ID
         FROM VEHICLE
         WHERE Customer_ID = ?`,
        [user.Customer_ID]
      );

      const vehicleIds = vehicles.map((vehicle) => vehicle.Vehicle_ID);

      if (vehicleIds.length === 0) {
        diagnostics = [];
      } else {
        diagnostics = await db
          .collection("vehicle_diagnostics")
          .find({ vehicle_id: { $in: vehicleIds } })
          .sort({ diagnostic_date: -1 })
          .toArray();
      }
    }

    return NextResponse.json({
      success: true,
      count: diagnostics.length,
      diagnostics,
    });
  } catch (error) {
    console.error("Diagnostics fetch error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch diagnostics" },
      { status: 500 }
    );
  }
}

// POST: Only Admin and Mechanic can create vehicle diagnostics.
export async function POST(request: Request) {
  const authError = await authorizeRoles(["Admin", "Mechanic"]);
  if (authError) return authError;

  try {
    const body: unknown = await request.json();
    const validation = diagnosticSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid diagnostic details",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      vehicle_id,
      booking_id,
    } = validation.data;

    // Confirm that the selected booking belongs to the selected vehicle.
    const [bookings] = await pool.execute<BookingVehicleRow[]>(
      `SELECT b.Booking_ID, b.Vehicle_ID
       FROM BOOKING b
       INNER JOIN VEHICLE v
         ON b.Vehicle_ID = v.Vehicle_ID
       WHERE b.Booking_ID = ?
         AND b.Vehicle_ID = ?`,
      [booking_id, vehicle_id]
    );

    if (bookings.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "The selected booking does not belong to this vehicle",
        },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(
      process.env.MONGODB_DATABASE || "car_service_nosql"
    );

    const diagnostic = {
      ...validation.data,
      diagnostic_date: validation.data.diagnostic_date || new Date(),
    };

    const result = await db
      .collection("vehicle_diagnostics")
      .insertOne(diagnostic);

    return NextResponse.json(
      {
        success: true,
        message: "Vehicle diagnostics created successfully",
        diagnostic_id: result.insertedId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Diagnostics creation error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to create diagnostics" },
      { status: 500 }
    );
  }
}
