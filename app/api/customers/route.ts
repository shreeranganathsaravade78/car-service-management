
import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

const staffRoles = ["Admin", "Receptionist"];

// GET: Admin/Receptionist see all customers.
// Customer sees only their own profile.
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

  if (!isStaff && user.Customer_ID === null) {
    return NextResponse.json(
      { success: false, message: "Your account is not linked to a customer profile" },
      { status: 403 }
    );
  }

  try {
    let customers: RowDataPacket[];

    if (isStaff) {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM CUSTOMER ORDER BY Customer_ID"
      );
      customers = rows;
    } else {
      const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT * FROM CUSTOMER WHERE Customer_ID = ?",
        [user.Customer_ID]
      );
      customers = rows;
    }

    return NextResponse.json({
      success: true,
      customers,
    });
  } catch (error) {
    console.error("Customer fetch error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch customers" },
      { status: 500 }
    );
  }
}

// POST: Only Admin and Receptionist can create customer records.
export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
    );
  }

  if (!user.Roles.some((role) => staffRoles.includes(role))) {
    return NextResponse.json(
      { success: false, message: "You do not have permission to create customers" },
      { status: 403 }
    );
  }

  try {
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

    if (!First_Name?.trim() || !Last_Name?.trim() || !Phone?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "First name, last name and phone are required",
        },
        { status: 400 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO CUSTOMER
      (First_Name, Last_Name, Phone, Email, House_Number,
       Street, Area, City, State, Postal_Code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Customer added successfully",
        Customer_ID: result.insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Customer insert error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to add customer" },
      { status: 500 }
    );
  }
}
