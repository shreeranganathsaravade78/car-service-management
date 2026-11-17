
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

export async function authorizeRoles(
  allowedRoles: string[]
): Promise<NextResponse | null> {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        message: "Authentication required. Please log in.",
      },
      { status: 401 }
    );
  }

  const hasPermission = user.Roles.some((role) =>
    allowedRoles.includes(role)
  );

  if (!hasPermission) {
    return NextResponse.json(
      {
        success: false,
        message: "You do not have permission to perform this action.",
      },
      { status: 403 }
    );
  }

  return null;
}
