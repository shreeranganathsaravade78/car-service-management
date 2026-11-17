
import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getSessionUser } from "@/lib/session";

interface PaymentRow extends RowDataPacket {
  Payment_ID: number;
  Invoice_ID: number;
  Booking_ID: number;
  Invoice_Status: string;
  Customer_ID: number;
  First_Name: string;
  Last_Name: string;
  Phone: string;
}

interface InvoiceOwnerRow extends RowDataPacket {
  Invoice_ID: number;
}

function getMySqlErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

const staffRoles = ["Admin", "Receptionist"];

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

// GET: Staff see all payments; customers see payments for their own invoices.
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
    `;

    const [rows] = isStaff
      ? await pool.query<PaymentRow[]>(
          `${query} ORDER BY p.Payment_ID`
        )
      : await pool.execute<PaymentRow[]>(
          `${query}
           WHERE v.Customer_ID = ?
           ORDER BY p.Payment_ID`,
          [user.Customer_ID]
        );

    return NextResponse.json({
      success: true,
      payments: rows,
    });
  } catch (error) {
    console.error("Payment fetch error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to fetch payments",
      },
      { status: 500 }
    );
  }
}

// POST: Staff can record payments for any invoice.
// Customers can record payments only for their own invoices.
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
      {
        success: false,
        message: "Your account is not linked to a customer profile",
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const {
      Invoice_ID,
      Amount,
      Payment_Method,
      Payment_Status,
    } = body;

    if (
      !Number.isInteger(Invoice_ID) ||
      Invoice_ID <= 0 ||
      Amount === undefined ||
      Amount === null ||
      Amount === "" ||
      !Payment_Method
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invoice ID, amount and payment method are required",
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

    // Customers cannot choose their own payment status.
    let paymentStatus = "Pending";

    if (isStaff) {
      if (
        typeof Payment_Status !== "string" ||
        !allowedStatuses.includes(Payment_Status)
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid payment status" },
          { status: 400 }
        );
      }

      paymentStatus = Payment_Status;
    }

    // Verify invoice ownership for customer accounts.
    if (!isStaff) {
      const [invoices] = await pool.execute<InvoiceOwnerRow[]>(
        `SELECT i.Invoice_ID
         FROM INVOICE i
         INNER JOIN BOOKING b
           ON i.Booking_ID = b.Booking_ID
         INNER JOIN VEHICLE v
           ON b.Vehicle_ID = v.Vehicle_ID
         WHERE i.Invoice_ID = ?
           AND v.Customer_ID = ?`,
        [Invoice_ID, user.Customer_ID]
      );

      if (invoices.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Invoice not found",
          },
          { status: 404 }
        );
      }
    }

    const paymentDate = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO PAYMENT
       (Invoice_ID, Payment_Date, Amount, Payment_Method, Payment_Status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        Invoice_ID,
        paymentDate,
        amount,
        Payment_Method,
        paymentStatus,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Payment recorded successfully",
        Payment_ID: result.insertId,
        Payment_Status: paymentStatus,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Payment insert error:", error);

    const errorCode = getMySqlErrorCode(error);

    if (errorCode === "ER_NO_REFERENCED_ROW_2") {
      return NextResponse.json(
        { success: false, message: "Invoice does not exist" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Unable to record payment" },
      { status: 500 }
    );
  }
}
