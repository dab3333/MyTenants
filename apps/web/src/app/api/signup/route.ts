import { NextResponse } from "next/server";
import { registerOrganization } from "@/lib/registerOrganization";

export async function POST(request: Request) {
  const body = await request.json();
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
