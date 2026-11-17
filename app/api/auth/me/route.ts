
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import pool from "@/lib/mysql";
import type { RowDataPacket } from "mysql2";

interface UserRow extends RowDataPacket {
  User_ID: number;
  Username: string;
  Email: string;
  Account_Status: string;
}

interface RoleRow extends RowDataPacket {
  Role_Name: string;
}

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";

    const sessionCookie = cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith("session="));

    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    const token = decodeURIComponent(
      sessionCookie.substring("session=".length)
    );

    const secret = process.env.SESSION_SECRET;

    if (!secret) {
      throw new Error("SESSION_SECRET is not configured");
    }

    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);

    const userId = Number(payload.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid session" },
        { status: 401 }
      );
    }

    const [users] = await pool.execute<UserRow[]>(
      `SELECT User_ID, Username, Email, Account_Status
       FROM APP_USER
       WHERE User_ID = ?`,
      [userId]
    );

    if (
      users.length === 0 ||
      users[0].Account_Status !== "Active"
    ) {
      return NextResponse.json(
        { success: false, message: "Account is unavailable" },
        { status: 401 }
      );
    }

    const [roles] = await pool.execute<RoleRow[]>(
      `SELECT r.Role_Name
       FROM USER_ROLE ur
       JOIN ROLE r ON ur.Role_ID = r.Role_ID
       WHERE ur.User_ID = ?`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        User_ID: users[0].User_ID,
        Username: users[0].Username,
        Email: users[0].Email,
        Roles: roles.map((role) => role.Role_Name),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid or expired session" },
      { status: 401 }
    );
  }
}
