
import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { authorizeRoles } from "@/lib/authorization";
import { getSessionUser } from "@/lib/session";

interface InvoiceRow extends RowDataPacket {
  Invoice_ID: number;
  Booking_ID: number;
  Vehicle_ID: number;
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

// GET: Staff can view any invoice; customers can view only their own.
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

  const invoiceId = Number(params.id);

  if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid invoice ID" },
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
        i.*,
        b.Vehicle_ID,
        b.Booking_Status,
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
      WHERE i.Invoice_ID = ?
    `;

    const [rows] = isStaff
      ? await pool.execute<InvoiceRow[]>(query, [invoiceId])
      : await pool.execute<InvoiceRow[]>(
          `${query} AND v.Customer_ID = ?`,
          [invoiceId, user.Customer_ID]
        );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Invoice not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      invoice: rows[0],
    });
  } catch (error) {
    console.error("Invoice fetch error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch invoice" },
      { status: 500 }
    );
  }
}

// PUT: Only Admin and Receptionist can update invoices.
export async function PUT(
  request: Request,
  { params }: RouteContext
) {
  const authError = await authorizeRoles(["Admin", "Receptionist"]);
  if (authError) return authError;

  try {
    const invoiceId = Number(params.id);

    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid invoice ID" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const {
      Labor_Charge,
      Tax_Amount,
      Discount_Amount,
    } = body;

    if (
      Labor_Charge === undefined ||
      Tax_Amount === undefined ||
      Discount_Amount === undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Labor charge, tax amount and discount amount are required",
        },
        { status: 400 }
      );
    }

    const labor = Number(Labor_Charge);
    const tax = Number(Tax_Amount);
    const discount = Number(Discount_Amount);

    if (
      !Number.isFinite(labor) || labor < 0 ||
      !Number.isFinite(tax) || tax < 0 ||
      !Number.isFinite(discount) || discount < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "All invoice amounts must be non-negative numbers",
        },
        { status: 400 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE INVOICE
       SET Labor_Charge = ?,
           Tax_Amount = ?,
           Discount_Amount = ?
       WHERE Invoice_ID = ?`,
      [labor, tax, discount, invoiceId]
    );

    if (result.affectedRows === 0) {
      const [rows] = await pool.execute<InvoiceRow[]>(
        "SELECT Invoice_ID FROM INVOICE WHERE Invoice_ID = ?",
        [invoiceId]
      );

      if (rows.length === 0) {
        return NextResponse.json(
          { success: false, message: "Invoice not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Invoice updated successfully",
      Invoice_ID: invoiceId,
    });
  } catch (error) {
    console.error("Invoice update error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to update invoice" },
      { status: 500 }
    );
  }
}

// DELETE: Only Admin and Receptionist can delete invoices.
export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  const authError = await authorizeRoles(["Admin", "Receptionist"]);
  if (authError) return authError;

  try {
    const invoiceId = Number(params.id);

    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid invoice ID" },
        { status: 400 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM INVOICE WHERE Invoice_ID = ?",
      [invoiceId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "Invoice not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Invoice deleted successfully",
      Invoice_ID: invoiceId,
    });
  } catch (error: unknown) {
    console.error("Invoice delete error:", error);

    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;

    if (errorCode === "ER_ROW_IS_REFERENCED_2") {
      return NextResponse.json(
        {
          success: false,
          message: "Cannot delete invoice because payment records exist.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Unable to delete invoice" },
      { status: 500 }
    );
  }
}
