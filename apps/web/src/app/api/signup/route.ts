import { NextResponse } from "next/server";
import { registerOrganization } from "@/lib/registerOrganization";
import { validateSignupBody } from "@/lib/validateSignupBody";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }

  const fields = body as Record<string, unknown>;
  const validationError = validateSignupBody(fields);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = await registerOrganization({
      organizationName: fields.organizationName as string,
      ownerName: fields.ownerName as string,
      email: fields.email as string,
      password: fields.password as string,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signup failed" },
      { status: 400 }
    );
  }
}
