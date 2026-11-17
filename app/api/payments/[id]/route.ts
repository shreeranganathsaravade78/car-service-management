
import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { authorizeRoles } from "@/lib/authorization";
import { getSessionUser } from "@/lib/session";

interface PaymentRow extends RowDataPacket {
  Payment_ID: number;
  Invoice_ID: number;
  Payment_Date: Date | string;
  Amount: number;
  Payment_Method: string;
  Payment_Status: string;
  Booking_ID: number;
  Invoice_Status: string;
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

const allowedMethods = [
  "Cash",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
];

const allowedStatuses = [
  "Success",
  "Pending",
  "Failed",
  "Refunded",
];

// GET: Staff can view any payment; customers can view only their own.
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

  const paymentId = Number(params.id);

  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid payment ID" },
      { status: 400 }
    );
  }

  const isStaff = user.Roles.some((role) =>
    ["Admin", "Receptionist"].includes(role)
  );
  const isCustomer = user.Roles.includes("Customer");

  if (!isStaff && !isCustomer) {
    return NextResponse.json(
      { success: false, message: "You do not have permission" },
      { status: 403 }
    );
  }

  if (isCustomer && !isStaff && user.Customer_ID === null) {
    return NextResponse.json(
      {
        success: false,
        message: "Your account is not linked to a customer profile",
      },
      { status: 403 }
    );
  }

  try {
    const query = `
      SELECT
        p.*,
        i.Booking_ID,
        i.Invoice_Status,
        c.Customer_ID,
        c.First_Name,
        c.Last_Name,
        c.Phone
      FROM PAYMENT p
      INNER JOIN INVOICE i
        ON p.Invoice_ID = i.Invoice_ID
      INNER JOIN BOOKING b
        ON i.Booking_ID = b.Booking_ID
      INNER JOIN VEHICLE v
        ON b.Vehicle_ID = v.Vehicle_ID
      INNER JOIN CUSTOMER c
        ON v.Customer_ID = c.Customer_ID
      WHERE p.Payment_ID = ?
    `;

    const [rows] = isStaff
      ? await pool.execute<PaymentRow[]>(query, [paymentId])
      : await pool.execute<PaymentRow[]>(
          `${query} AND v.Customer_ID = ?`,
          [paymentId, user.Customer_ID]
        );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Payment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      payment: rows[0],
    });
  } catch (error) {
    console.error("Payment fetch error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch payment" },
      { status: 500 }
    );
  }
}

// PUT: Only Admin and Receptionist can update payments.
export async function PUT(
  request: Request,
  { params }: RouteContext
) {
  const authError = await authorizeRoles(["Admin", "Receptionist"]);
  if (authError) return authError;

  try {
    const paymentId = Number(params.id);

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid payment ID" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const {
      Amount,
      Payment_Method,
      Payment_Status,
    } = body;

    if (
      Amount === undefined ||
      Amount === null ||
      Amount === "" ||
      !Payment_Method ||
      !Payment_Status
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Amount, payment method and payment status are required",
        },
        { status: 400 }
      );
    }

    const amount = Number(Amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, message: "Payment amount must be greater than zero" },
        { status: 400 }
      );
    }

    if (
      typeof Payment_Method !== "string" ||
      !allowedMethods.includes(Payment_Method)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid payment method" },
        { status: 400 }
      );
    }

    if (
      typeof Payment_Status !== "string" ||
      !allowedStatuses.includes(Payment_Status)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid payment status" },
        { status: 400 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE PAYMENT
       SET Amount = ?,
           Payment_Method = ?,
           Payment_Status = ?
       WHERE Payment_ID = ?`,
      [amount, Payment_Method, Payment_Status, paymentId]
    );

    if (result.affectedRows === 0) {
      const [rows] = await pool.execute<PaymentRow[]>(
        "SELECT Payment_ID FROM PAYMENT WHERE Payment_ID = ?",
        [paymentId]
      );

      if (rows.length === 0) {
        return NextResponse.json(
          { success: false, message: "Payment not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment updated successfully",
      Payment_ID: paymentId,
    });
  } catch (error) {
    console.error("Payment update error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to update payment" },
      { status: 500 }
    );
  }
}

// DELETE: Only Admin and Receptionist can delete payments.
export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  const authError = await authorizeRoles(["Admin", "Receptionist"]);
  if (authError) return authError;

  try {
    const paymentId = Number(params.id);

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid payment ID" },
        { status: 400 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM PAYMENT WHERE Payment_ID = ?",
      [paymentId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "Payment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Payment deleted successfully",
      Payment_ID: paymentId,
    });
  } catch (error) {
    console.error("Payment delete error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to delete payment" },
      { status: 500 }
    );
  }
}
