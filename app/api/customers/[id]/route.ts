
import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface CustomerRow extends RowDataPacket {
  Customer_ID: number;
  First_Name: string;
  Last_Name: string;
  Phone: string;
  Email: string | null;
  House_Number: string | null;
  Street: string | null;
  Area: string | null;
  City: string | null;
  State: string | null;
  Postal_Code: string | null;
}

const staffRoles = ["Admin", "Receptionist"];

// GET: Staff can view any customer.
// Customer can view only their own profile.
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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
      { success: false, message: "Your account is not linked to a customer profile" },
      { status: 403 }
    );
  }

  try {
    const customerId = Number(params.id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid customer ID" },
        { status: 400 }
      );
    }

    const [rows] = isStaff
      ? await pool.execute<CustomerRow[]>(
          "SELECT * FROM CUSTOMER WHERE Customer_ID = ?",
          [customerId]
        )
      : await pool.execute<CustomerRow[]>(
          "SELECT * FROM CUSTOMER WHERE Customer_ID = ? AND Customer_ID = ?",
          [customerId, user.Customer_ID]
        );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      customer: rows[0],
    });
  } catch (error) {
    console.error("Customer fetch error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch customer" },
      { status: 500 }
    );
  }
}

// PUT: Staff can update any customer.
// Customer can update only their own profile.
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
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
      { success: false, message: "Your account is not linked to a customer profile" },
      { status: 403 }
    );
  }

  try {
    const customerId = Number(params.id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid customer ID" },
        { status: 400 }
      );
    }

    // Verify customer ownership before updating.
    const [existing] = isStaff
      ? await pool.execute<CustomerRow[]>(
          "SELECT * FROM CUSTOMER WHERE Customer_ID = ?",
          [customerId]
        )
      : await pool.execute<CustomerRow[]>(
          "SELECT * FROM CUSTOMER WHERE Customer_ID = ? AND Customer_ID = ?",
          [customerId, user.Customer_ID]
        );

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const {
      First_Name,
      Last_Name,
      Phone,
      Email,
      House_Number,
      Street,
      Area,
      City,
      State,
      Postal_Code,
    } = body;

    if (
      !First_Name?.trim() ||
      !Last_Name?.trim() ||
      !Phone?.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "First name, last name and phone are required",
        },
        { status: 400 }
      );
    }

    // Customer_ID is deliberately not accepted from the request body.
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE CUSTOMER
       SET First_Name = ?,
           Last_Name = ?,
           Phone = ?,
           Email = ?,
           House_Number = ?,
           Street = ?,
           Area = ?,
           City = ?,
           State = ?,
           Postal_Code = ?
       WHERE Customer_ID = ?`,
      [
        First_Name.trim(),
        Last_Name.trim(),
        Phone.trim(),
        Email?.trim() || null,
        House_Number?.trim() || null,
        Street?.trim() || null,
        Area?.trim() || null,
        City?.trim() || null,
        State?.trim() || null,
        Postal_Code?.trim() || null,
        customerId,
      ]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "Customer was not updated" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Customer updated successfully",
      Customer_ID: customerId,
    });
  } catch (error) {
    console.error("Customer update error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to update customer" },
      { status: 500 }
    );
  }
}

// DELETE: Only Admin and Receptionist can delete customers.
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
    );
  }

  const isStaff = user.Roles.some((role) => staffRoles.includes(role));

  if (!isStaff) {
    return NextResponse.json(
      { success: false, message: "You do not have permission to delete customers" },
      { status: 403 }
    );
  }

  try {
    const customerId = Number(params.id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid customer ID" },
        { status: 400 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM CUSTOMER WHERE Customer_ID = ?",
      [customerId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Customer deleted successfully",
      Customer_ID: customerId,
    });
  } catch (error: unknown) {
    console.error("Customer delete error:", error);

    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;

    if (errorCode === "ER_ROW_IS_REFERENCED_2") {
      return NextResponse.json(
        {
          success: false,
          message: "Cannot delete customer because related records exist.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Unable to delete customer" },
      { status: 500 }
    );
  }
}
