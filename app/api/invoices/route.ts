
import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { authorizeRoles } from "@/lib/authorization";
import { getSessionUser } from "@/lib/session";

interface InvoiceRow extends RowDataPacket {
  Invoice_ID: number;
  Booking_ID: number;
  Vehicle_ID: number;
  Customer_ID: number;
  First_Name: string;
  Last_Name: string;
  Phone: string;
  Registration_Number: string;
  Manufacturer: string;
  Model: string;
}

function getMySqlErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

// GET: Staff see all invoices; customers see only their own invoices.
export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
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
        i.*,
        b.Vehicle_ID,
        v.Registration_Number,
        v.Manufacturer,
        v.Model,
        c.Customer_ID,
        c.First_Name,
        c.Last_Name,
        c.Phone
      FROM INVOICE i
      INNER JOIN BOOKING b
        ON i.Booking_ID = b.Booking_ID
      INNER JOIN VEHICLE v
        ON b.Vehicle_ID = v.Vehicle_ID
      INNER JOIN CUSTOMER c
        ON v.Customer_ID = c.Customer_ID
    `;

    const [rows] = isStaff
      ? await pool.query<InvoiceRow[]>(
          `${query} ORDER BY i.Invoice_ID`
        )
      : await pool.execute<InvoiceRow[]>(
          `${query}
           WHERE v.Customer_ID = ?
           ORDER BY i.Invoice_ID`,
          [user.Customer_ID]
        );

    return NextResponse.json({
      success: true,
      invoices: rows,
    });
  } catch (error) {
    console.error("Invoice fetch error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to fetch invoices",
      },
      { status: 500 }
    );
  }
}

// POST: Only Admin and Receptionist can create invoices.
export async function POST(request: Request) {
  const authError = await authorizeRoles(["Admin", "Receptionist"]);
  if (authError) return authError;

  try {
    const body = await request.json();

    const {
      Booking_ID,
      Labor_Charge,
      Tax_Amount,
      Discount_Amount,
    } = body;

    if (
      !Number.isInteger(Booking_ID) ||
      Booking_ID <= 0
    ) {
      return NextResponse.json(
        { success: false, message: "Valid Booking ID is required" },
        { status: 400 }
      );
    }

    const labor = Number(Labor_Charge ?? 0);
    const tax = Number(Tax_Amount ?? 0);
    const discount = Number(Discount_Amount ?? 0);

    if (
      !Number.isFinite(labor) ||
      labor < 0 ||
      !Number.isFinite(tax) ||
      tax < 0 ||
      !Number.isFinite(discount) ||
      discount < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Charges, tax and discount must be non-negative numbers",
        },
        { status: 400 }
      );
    }

    const invoiceDate = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO INVOICE
       (Booking_ID, Invoice_Date, Labor_Charge,
        Tax_Amount, Discount_Amount, Invoice_Status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        Booking_ID,
        invoiceDate,
        labor,
        tax,
        discount,
        "Unpaid",
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Invoice created successfully",
        Invoice_ID: result.insertId,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Invoice insert error:", error);

    const errorCode = getMySqlErrorCode(error);

    if (errorCode === "ER_DUP_ENTRY") {
      return NextResponse.json(
        {
          success: false,
          message: "An invoice already exists for this booking",
        },
        { status: 409 }
      );
    }

    if (errorCode === "ER_NO_REFERENCED_ROW_2") {
      return NextResponse.json(
        { success: false, message: "Booking does not exist" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Unable to create invoice" },
      { status: 500 }
    );
  }
}
