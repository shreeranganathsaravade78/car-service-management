
import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { verifyPassword } from "@/lib/auth";
import { SignJWT } from "jose";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";

interface UserRow extends RowDataPacket {
  User_ID: number;
  Username: string;
  Email: string;
  Password_Hash: string;
  Account_Status: string;
}

interface RoleRow extends RowDataPacket {
  Role_Name: string;
}

const loginSchema = z.object({
  Email: z.string().trim().email(),
  Password: z.string().min(1).max(72),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password format" },
        { status: 400 }
      );
    }

    const { Email, Password } = validation.data;

    // Find user by email
    const [users] = await pool.execute<UserRow[]>(
      `SELECT User_ID, Username, Email, Password_Hash,
              Account_Status
       FROM APP_USER
       WHERE Email = ?`,
      [Email]
    );

    if (users.length === 0) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password" },
        { status: 401 }
      );
    }

    const user = users[0];

    // Check account status
    if (user.Account_Status !== "Active") {
      return NextResponse.json(
        { success: false, message: "Your account is disabled" },
        { status: 403 }
      );
    }

    // Verify password
    const passwordMatches = await verifyPassword(
      Password,
      user.Password_Hash
    );

    if (!passwordMatches) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Retrieve assigned roles
    const [roles] = await pool.execute<RoleRow[]>(
      `SELECT r.Role_Name
       FROM USER_ROLE ur
       INNER JOIN ROLE r ON ur.Role_ID = r.Role_ID
       WHERE ur.User_ID = ?`,
      [user.User_ID]
    );

    if (roles.length === 0) {
      return NextResponse.json(
        { success: false, message: "No role assigned to this account" },
        { status: 403 }
      );
    }

    const roleNames = roles.map((role) => role.Role_Name);

    const secret = process.env.SESSION_SECRET;

    if (!secret) {
      throw new Error("SESSION_SECRET is not configured");
    }

    const secretKey = new TextEncoder().encode(secret);

    // Create signed session token
    const token = await new SignJWT({
      userId: user.User_ID,
      username: user.Username,
      roles: roleNames,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1d")
      .sign(secretKey);

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      user: {
        User_ID: user.User_ID,
        Username: user.Username,
        Email: user.Email,
        Roles: roleNames,
      },
    });

    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to login" },
      { status: 500 }
    );
  }
}
