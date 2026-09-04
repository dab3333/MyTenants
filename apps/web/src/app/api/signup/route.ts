import { NextResponse } from "next/server";
import { registerOrganization } from "@/lib/registerOrganization";

const REQUIRED_FIELDS = ["organizationName", "ownerName", "email", "password"] as const;

export function validateSignupBody(
  body: Record<string, unknown>
): string | null {
  for (const field of REQUIRED_FIELDS) {
    const value = body[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      return `${field} is required`;
    }
  }
  return null;
}

export async function POST(request: Request) {
  const body = await request.json();

  const validationError = validateSignupBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = await registerOrganization({
      organizationName: body.organizationName,
      ownerName: body.ownerName,
      email: body.email,
      password: body.password,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signup failed" },
      { status: 400 }
    );
  }
}
