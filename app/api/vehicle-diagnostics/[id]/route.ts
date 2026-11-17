
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import type { Document } from "mongodb";
import clientPromise from "@/lib/mongodb";
import pool from "@/lib/mysql";
import type { RowDataPacket } from "mysql2";
import { getSessionUser } from "@/lib/session";
import { authorizeRoles } from "@/lib/authorization";
import { z } from "zod";

interface RouteContext {
  params: {
    id: string;
  };
}

interface VehicleOwnerRow extends RowDataPacket {
  Vehicle_ID: number;
}

interface BookingVehicleRow extends RowDataPacket {
  Booking_ID: number;
  Vehicle_ID: number;
}

const diagnosticUpdateSchema = z.object({
  vehicle_id: z.number().int().positive().optional(),
  booking_id: z.number().int().positive().optional(),
  diagnostic_date: z.coerce.date().optional(),
  engine_temperature: z.number().nonnegative().optional(),
  battery_voltage: z.number().nonnegative().optional(),
  oil_level: z.string().trim().min(1).optional(),
  brake_condition: z.string().trim().min(1).optional(),
  alerts: z.array(z.string().trim()).optional(),
  overall_status: z.string().trim().min(1).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" }
);

function getObjectId(id: string): ObjectId | null {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return null;
  }

  return new ObjectId(id);
}

// GET: Admin can view all records.
// Customers can view records belonging to their own vehicles.
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

  const isAdmin = user.Roles.includes("Admin");
  const isCustomer = user.Roles.includes("Customer");

  if (!isAdmin && !isCustomer) {
    return NextResponse.json(
      { success: false, message: "You do not have permission" },
      { status: 403 }
    );
  }

  if (!isAdmin && user.Customer_ID === null) {
    return NextResponse.json(
      {
        success: false,
        message: "Your account is not linked to a customer profile",
      },
      { status: 403 }
    );
  }

  const objectId = getObjectId(params.id);

  if (!objectId) {
    return NextResponse.json(
      { success: false, message: "Invalid diagnostic ID" },
      { status: 400 }
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db(
      process.env.MONGODB_DATABASE || "car_service_nosql"
    );

    const diagnostic = await db
      .collection("vehicle_diagnostics")
      .findOne({ _id: objectId });

    if (!diagnostic) {
      return NextResponse.json(
        { success: false, message: "Diagnostic record not found" },
        { status: 404 }
      );
    }

    // Verify that the diagnostic vehicle belongs to the customer.
    if (!isAdmin) {
      const vehicleId = Number(diagnostic.vehicle_id);

      const [vehicles] = await pool.execute<VehicleOwnerRow[]>(
        `SELECT Vehicle_ID
         FROM VEHICLE
         WHERE Vehicle_ID = ? AND Customer_ID = ?`,
        [vehicleId, user.Customer_ID]
      );

      if (vehicles.length === 0) {
        return NextResponse.json(
          { success: false, message: "Diagnostic record not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      diagnostic: {
        ...diagnostic,
        _id: diagnostic._id.toString(),
      },
    });
  } catch (error) {
    console.error("Diagnostic fetch error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch diagnostic record" },
      { status: 500 }
    );
  }
}

// PUT: Only Admin can update diagnostic records.
export async function PUT(
  request: Request,
  { params }: RouteContext
) {
  const authError = await authorizeRoles(["Admin"]);
  if (authError) return authError;

  const objectId = getObjectId(params.id);

  if (!objectId) {
    return NextResponse.json(
      { success: false, message: "Invalid diagnostic ID" },
      { status: 400 }
    );
  }

  try {
    const body: unknown = await request.json();
    const validation = diagnosticUpdateSchema.safeParse(body);

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

    const client = await clientPromise;
    const db = client.db(
      process.env.MONGODB_DATABASE || "car_service_nosql"
    );

    const collection = db.collection<Document>("vehicle_diagnostics");

    const existing = await collection.findOne({ _id: objectId });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Diagnostic record not found" },
        { status: 404 }
      );
    }

    const vehicleId =
      validation.data.vehicle_id ?? Number(existing.vehicle_id);

    const bookingId =
      validation.data.booking_id ?? Number(existing.booking_id);

    // Confirm that the booking belongs to the selected vehicle.
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

    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          ...validation.data,
          updated_at: new Date(),
        },
      }
    );

    const updated = await collection.findOne({ _id: objectId });

    return NextResponse.json({
      success: true,
      message: "Diagnostic record updated successfully",
      diagnostic: updated
        ? { ...updated, _id: updated._id.toString() }
        : null,
    });
  } catch (error) {
    console.error("Diagnostic update error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to update diagnostic record" },
      { status: 500 }
    );
  }
}

// DELETE: Only Admin can delete diagnostic records.
export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  const authError = await authorizeRoles(["Admin"]);
  if (authError) return authError;

  const objectId = getObjectId(params.id);

  if (!objectId) {
    return NextResponse.json(
      { success: false, message: "Invalid diagnostic ID" },
      { status: 400 }
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db(
      process.env.MONGODB_DATABASE || "car_service_nosql"
    );

    const result = await db
      .collection("vehicle_diagnostics")
      .deleteOne({ _id: objectId });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: "Diagnostic record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Diagnostic record deleted successfully",
    });
  } catch (error) {
    console.error("Diagnostic delete error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to delete diagnostic record" },
      { status: 500 }
    );
  }
}
