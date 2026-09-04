import { NextResponse } from "next/server";
import { registerOrganization } from "@/lib/registerOrganization";
import { validateSignupBody } from "@/lib/validateSignupBody";

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
