
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import pool from "@/lib/mysql";
import type { RowDataPacket } from "mysql2";
import { authorizeRoles } from "@/lib/authorization";
import { z } from "zod";

const reportSchema = z.object({
  booking_id: z.number().int().positive(),
  vehicle_id: z.number().int().positive(),
  mechanic_id: z.number().int().positive(),
  inspection_date: z.coerce.date().optional(),
  observations: z.array(
    z.object({
      component: z.string().trim().min(1),
      condition: z.string().trim().min(1),
      remarks: z.string().optional().default(""),
    })
  ).default([]),
  recommendations: z.array(z.string().trim()).default([]),
});

interface BookingVehicleRow extends RowDataPacket {
  Booking_ID: number;
  Vehicle_ID: number;
}

interface MechanicRow extends RowDataPacket {
  Mechanic_ID: number;
}

// GET: Admin, Receptionist and Mechanic can view all reports.
export async function GET() {
  const authError = await authorizeRoles([
    "Admin",
    "Receptionist",
    "Mechanic",
  ]);

  if (authError) return authError;

  try {
    const client = await clientPromise;
    const db = client.db(
      process.env.MONGODB_DATABASE || "car_service_nosql"
    );

    const reports = await db
      .collection("service_reports")
      .find({})
      .sort({ inspection_date: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (error) {
    console.error("Service reports fetch error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch service reports" },
      { status: 500 }
    );
  }
}

// POST: Only Admin and Mechanic can create service reports.
export async function POST(request: Request) {
  const authError = await authorizeRoles(["Admin", "Mechanic"]);

  if (authError) return authError;

  try {
    const body: unknown = await request.json();
    const validation = reportSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid service report details",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      booking_id,
      vehicle_id,
      mechanic_id,
    } = validation.data;

    // Verify that the booking belongs to the selected vehicle.
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

    // Verify that the selected mechanic exists.
    const [mechanics] = await pool.execute<MechanicRow[]>(
      `SELECT Mechanic_ID
       FROM MECHANIC
       WHERE Mechanic_ID = ?`,
      [mechanic_id]
    );

    if (mechanics.length === 0) {
      return NextResponse.json(
        { success: false, message: "Selected mechanic does not exist" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(
      process.env.MONGODB_DATABASE || "car_service_nosql"
    );

    const now = new Date();

    const report = {
      ...validation.data,
      inspection_date: validation.data.inspection_date || now,
      created_at: now,
      updated_at: now,
    };

    const result = await db
      .collection("service_reports")
      .insertOne(report);

    return NextResponse.json(
      {
        success: true,
        message: "Service report created successfully",
        report_id: result.insertedId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Service report creation error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to create service report" },
      { status: 500 }
    );
  }
}
