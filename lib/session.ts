
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import type { RowDataPacket } from "mysql2";
import pool from "@/lib/mysql";

interface UserRow extends RowDataPacket {
  User_ID: number;
  Username: string;
  Email: string;
  Customer_ID: number | null;
  Account_Status: string;
}

interface RoleRow extends RowDataPacket {
  Role_Name: string;
}

export interface SessionUser {
  User_ID: number;
  Username: string;
  Email: string;
  Customer_ID: number | null;
  Roles: string[];
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const token = cookies().get("session")?.value;

    if (!token) {
      return null;
    }

    const secret = process.env.SESSION_SECRET;

    if (!secret) {
      throw new Error("SESSION_SECRET is not configured");
    }

    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);

    const userId = Number(payload.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return null;
    }

    const [users] = await pool.execute<UserRow[]>(
      `SELECT User_ID, Username, Email, Customer_ID, Account_Status
       FROM APP_USER
       WHERE User_ID = ?`,
      [userId]
    );

    if (users.length === 0 || users[0].Account_Status !== "Active") {
      return null;
    }

    const [roles] = await pool.execute<RoleRow[]>(
      `SELECT r.Role_Name
       FROM USER_ROLE ur
       JOIN ROLE r ON ur.Role_ID = r.Role_ID
       WHERE ur.User_ID = ?`,
      [userId]
    );

    return {
      User_ID: users[0].User_ID,
      Username: users[0].Username,
      Email: users[0].Email,
      Customer_ID: users[0].Customer_ID,
      Roles: roles.map((role) => role.Role_Name),
    };
  } catch {
    return null;
  }
}

export async function hasRole(allowedRoles: string[]): Promise<boolean> {
  const user = await getSessionUser();

  if (!user) {
    return false;
  }

  return user.Roles.some((role) => allowedRoles.includes(role));
}
