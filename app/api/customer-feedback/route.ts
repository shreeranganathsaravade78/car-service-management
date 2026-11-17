
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import pool from "@/lib/mysql";
import type { RowDataPacket } from "mysql2";
import { getSessionUser } from "@/lib/session";
import { z } from "zod";

const feedbackSchema = z.object({
  booking_id: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  feedback: z.string().trim().min(1).max(1000),
  service_quality: z.string().trim().min(1).max(50),
});

interface BookingOwnerRow extends RowDataPacket {
  Booking_ID: number;
}

// Allow only accounts with the Customer role.
async function getCustomerAccess() {
  const user = await getSessionUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  // Only users with exactly the Customer role are allowed.
  if (
    user.Roles.length !== 1 ||
    user.Roles[0] !== "Customer"
  ) {
    return {
      user: null,
      response: NextResponse.json(
        {
          success: false,
          message: "Only customer accounts can access customer feedback",
        },
        { status: 403 }
      ),
    };
  }

  if (user.Customer_ID === null) {
    return {
      user: null,
      response: NextResponse.json(
        {
          success: false,
          message: "Your account is not linked to a customer profile",
        },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}

// GET: A customer can view only their own feedback.
export async function GET() {
  const access = await getCustomerAccess();

  if (access.response) return access.response;

  try {
    const client = await clientPromise;
    const db = client.db(
      process.env.MONGODB_DATABASE || "car_service_nosql"
    );

    const feedback = await db
      .collection("customer_feedback")
      .find({ customer_id: access.user!.Customer_ID })
      .sort({ submitted_at: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      count: feedback.length,
      feedback,
    });
  } catch (error) {
    console.error("Feedback fetch error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch customer feedback" },
      { status: 500 }
    );
  }
}

// POST: Customers can submit feedback only for their own bookings.
export async function POST(request: Request) {
  const access = await getCustomerAccess();

  if (access.response) return access.response;

  try {
    const body: unknown = await request.json();
    const validation = feedbackSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid feedback details",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { booking_id, rating, feedback, service_quality } =
      validation.data;

    // Confirm that this booking belongs to the logged-in customer.
    const [bookings] = await pool.execute<BookingOwnerRow[]>(
      `SELECT b.Booking_ID
       FROM BOOKING b
       INNER JOIN VEHICLE v
         ON b.Vehicle_ID = v.Vehicle_ID
       WHERE b.Booking_ID = ?
         AND v.Customer_ID = ?`,
      [booking_id, access.user!.Customer_ID]
    );

    if (bookings.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Booking not found for your account",
        },
        { status: 404 }
      );
    }

    const client = await clientPromise;
    const db = client.db(
      process.env.MONGODB_DATABASE || "car_service_nosql"
    );

    // Customer_ID comes from the authenticated session, not the request body.
    const feedbackDocument = {
      booking_id,
      customer_id: access.user!.Customer_ID,
      rating,
      feedback,
      service_quality,
      submitted_at: new Date(),
    };

    const result = await db
      .collection("customer_feedback")
      .insertOne(feedbackDocument);

    return NextResponse.json(
      {
        success: true,
        message: "Customer feedback submitted successfully",
        feedback_id: result.insertedId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Feedback creation error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to submit feedback" },
      { status: 500 }
    );
  }
}
