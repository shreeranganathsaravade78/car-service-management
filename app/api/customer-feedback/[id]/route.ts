
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { z } from "zod";

const feedbackUpdateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().trim().min(1).max(1000),
  service_quality: z.string().trim().min(1).max(50),
});

// Allow only Customer accounts.
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

  if (
    user.Roles.length !== 1 ||
    user.Roles[0] !== "Customer"
  ) {
    return {
      user: null,
      response: NextResponse.json(
        {
          success: false,
          message: "Only customers can manage their feedback",
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

function parseFeedbackId(id: string): ObjectId | null {
  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    return null;
  }

  return new ObjectId(id);
}

// GET: Retrieve one feedback record belonging to the logged-in customer.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const access = await getCustomerAccess();

  if (access.response) {
    return access.response;
  }

  const feedbackId = parseFeedbackId(params.id);

  if (!feedbackId) {
    return NextResponse.json(
      { success: false, message: "Invalid feedback ID" },
      { status: 400 }
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db(
      process.env.MONGODB_DATABASE || "car_service_nosql"
    );

    const feedback = await db.collection("customer_feedback").findOne({
      _id: feedbackId,
      customer_id: access.user!.Customer_ID,
    });

    if (!feedback) {
      return NextResponse.json(
        { success: false, message: "Feedback not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      feedback,
    });
  } catch (error) {
    console.error("Feedback fetch error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch feedback" },
      { status: 500 }
    );
  }
}

// PUT: Update the rating and feedback of the customer's own record.
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const access = await getCustomerAccess();

  if (access.response) {
    return access.response;
  }

  const feedbackId = parseFeedbackId(params.id);

  if (!feedbackId) {
    return NextResponse.json(
      { success: false, message: "Invalid feedback ID" },
      { status: 400 }
    );
  }

  try {
    const body: unknown = await request.json();
    const validation = feedbackUpdateSchema.safeParse(body);

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

    const client = await clientPromise;
    const db = client.db(
      process.env.MONGODB_DATABASE || "car_service_nosql"
    );

    const result = await db.collection("customer_feedback").updateOne(
      {
        _id: feedbackId,
        customer_id: access.user!.Customer_ID,
      },
      {
        $set: {
          ...validation.data,
          updated_at: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, message: "Feedback not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Customer feedback updated successfully",
    });
  } catch (error) {
    console.error("Feedback update error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to update feedback" },
      { status: 500 }
    );
  }
}

// DELETE: Delete only the logged-in customer's own feedback.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const access = await getCustomerAccess();

  if (access.response) {
    return access.response;
  }

  const feedbackId = parseFeedbackId(params.id);

  if (!feedbackId) {
    return NextResponse.json(
      { success: false, message: "Invalid feedback ID" },
      { status: 400 }
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db(
      process.env.MONGODB_DATABASE || "car_service_nosql"
    );

    const result = await db.collection("customer_feedback").deleteOne({
      _id: feedbackId,
      customer_id: access.user!.Customer_ID,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: "Feedback not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Customer feedback deleted successfully",
    });
  } catch (error) {
    console.error("Feedback deletion error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to delete feedback" },
      { status: 500 }
    );
  }
}
