
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import pool from "@/lib/mysql";
import type { RowDataPacket } from "mysql2";
import { authorizeRoles } from "@/lib/authorization";
import { z } from "zod";

interface RouteContext {
  params: {
    id: string;
  };
}

interface BookingVehicleRow extends RowDataPacket {
  Booking_ID: number;
  Vehicle_ID: number;
}

interface MechanicRow extends RowDataPacket {
  Mechanic_ID: number;
}

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

const reportUpdateSchema = reportSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required for update" }
);

function getObjectId(id: string): ObjectId | null {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return null;
  }

  return new ObjectId(id);
}

// GET: Admin, Receptionist and Mechanic can view individual reports.
export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const authError = await authorizeRoles([
    "Admin",
    "Receptionist",
    "Mechanic",
  ]);

  if (authError) return authError;

  const objectId = getObjectId(params.id);

  if (!objectId) {
    return NextResponse.json(
      { success: false, message: "Invalid service report ID" },
      { status: 400 }
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db(
      process.env.MONGODB_DATABASE || "car_service_nosql"
    );

    const report = await db
      .collection("service_reports")
      .findOne({ _id: objectId });

    if (!report) {
      return NextResponse.json(
        { success: false, message: "Service report not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      report: {
        ...report,
        _id: report._id.toString(),
      },
    });
  } catch (error) {
    console.error("Service report fetch error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch service report" },
      { status: 500 }
    );
  }
}

// PUT: Only Admin can update service reports.
export async function PUT(
  request: Request,
  { params }: RouteContext
) {
  const authError = await authorizeRoles(["Admin"]);
  if (authError) return authError;

  const objectId = getObjectId(params.id);

  if (!objectId) {
    return NextResponse.json(
      { success: false, message: "Invalid service report ID" },
      { status: 400 }
    );
  }

  try {
    const body: unknown = await request.json();
    const validation = reportUpdateSchema.safeParse(body);

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

    const client = await clientPromise;
    const db = client.db(
      process.env.MONGODB_DATABASE || "car_service_nosql"
    );

    const collection = db.collection("service_reports");

    const existing = await collection.findOne({ _id: objectId });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Service report not found" },
        { status: 404 }
      );
    }

    // Use the existing values for fields not supplied in the update.
    const bookingId =
      validation.data.booking_id ?? Number(existing.booking_id);

    const vehicleId =
      validation.data.vehicle_id ?? Number(existing.vehicle_id);

    const mechanicId =
      validation.data.mechanic_id ?? Number(existing.mechanic_id);

    // Verify that the booking belongs to the selected vehicle.
    const [bookings] = await pool.execute<BookingVehicleRow[]>(
      `SELECT Booking_ID, Vehicle_ID
       FROM BOOKING
       WHERE Booking_ID = ? AND Vehicle_ID = ?`,
      [bookingId, vehicleId]
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
      [mechanicId]
    );

    if (mechanics.length === 0) {
      return NextResponse.json(
        { success: false, message: "Selected mechanic does not exist" },
        { status: 400 }
      );
    }

    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          ...validation.data,
          updated_at: new Date(),
        },
      }
    );

    const updatedReport = await collection.findOne({ _id: objectId });

    return NextResponse.json({
      success: true,
      message: "Service report updated successfully",
      report: updatedReport
        ? {
            ...updatedReport,
            _id: updatedReport._id.toString(),
          }
        : null,
    });
  } catch (error) {
    console.error("Service report update error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to update service report" },
      { status: 500 }
    );
  }
}

// DELETE: Only Admin can delete service reports.
export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  const authError = await authorizeRoles(["Admin"]);
  if (authError) return authError;

  const objectId = getObjectId(params.id);

  if (!objectId) {
    return NextResponse.json(
      { success: false, message: "Invalid service report ID" },
      { status: 400 }
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db(
      process.env.MONGODB_DATABASE || "car_service_nosql"
    );

    const result = await db
      .collection("service_reports")
      .deleteOne({ _id: objectId });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: "Service report not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Service report deleted successfully",
    });
  } catch (error) {
    console.error("Service report delete error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to delete service report" },
      { status: 500 }
    );
  }
}
