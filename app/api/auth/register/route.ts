
import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { hashPassword } from "@/lib/auth";
import { z } from "zod";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface ExistingUserRow extends RowDataPacket {
  User_ID: number;
}

interface RoleRow extends RowDataPacket {
  Role_ID: number;
}

function getMySqlErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

const registerSchema = z.object({
  First_Name: z.string().trim().min(2).max(50),
  Last_Name: z.string().trim().min(1).max(50),
  Phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, {
    message: "Enter a valid phone number",
  }),
  Username: z.string().trim().min(3).max(50),
  Email: z.string().trim().email().max(100),
  Password: z.string().min(8).max(72),
  Role_Name: z.literal("Customer"),
});

export async function POST(request: Request) {
  let connection;

  try {
    const body: unknown = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid registration details",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      First_Name,
      Last_Name,
      Phone,
      Username,
      Email,
      Password,
      Role_Name,
    } = validation.data;

    // Hash password before opening the database transaction.
    const passwordHash = await hashPassword(Password);

    connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Check whether the username or email already exists.
      const [existing] = await connection.execute<ExistingUserRow[]>(
        `SELECT User_ID
         FROM APP_USER
         WHERE Username = ? OR Email = ?`,
        [Username, Email]
      );

      if (existing.length > 0) {
        await connection.rollback();

        return NextResponse.json(
          {
            success: false,
            message: "Username or email already exists",
          },
          { status: 409 }
        );
      }

      // Find the Customer role.
      const [roles] = await connection.execute<RoleRow[]>(
        "SELECT Role_ID FROM ROLE WHERE Role_Name = ?",
        [Role_Name]
      );

      if (roles.length === 0) {
        await connection.rollback();

        return NextResponse.json(
          { success: false, message: "Customer role not found" },
          { status: 400 }
        );
      }

      // 1. Create the customer profile.
      const [customerResult] =
        await connection.execute<ResultSetHeader>(
          `INSERT INTO CUSTOMER
           (First_Name, Last_Name, Phone, Email)
           VALUES (?, ?, ?, ?)`,
          [First_Name, Last_Name, Phone, Email]
        );

      const customerId = customerResult.insertId;

      // 2. Create the login account and link it to the customer.
      const [userResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO APP_USER
         (Username, Email, Password_Hash, Customer_ID)
         VALUES (?, ?, ?, ?)`,
        [Username, Email, passwordHash, customerId]
      );

      const userId = userResult.insertId;

      // 3. Assign the Customer role.
      await connection.execute(
        `INSERT INTO USER_ROLE (User_ID, Role_ID)
         VALUES (?, ?)`,
        [userId, roles[0].Role_ID]
      );

      // All three operations succeeded.
      await connection.commit();

      return NextResponse.json(
        {
          success: true,
          message: "Customer registered successfully",
          User_ID: userId,
          Customer_ID: customerId,
          Role: Role_Name,
        },
        { status: 201 }
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Registration error:", error);

    const errorCode = getMySqlErrorCode(error);

    if (errorCode === "ER_DUP_ENTRY") {
      return NextResponse.json(
        {
          success: false,
          message: "Username, email or customer details already exist",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Unable to register user",
      },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
