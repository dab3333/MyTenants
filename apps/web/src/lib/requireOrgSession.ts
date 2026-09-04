import { NextResponse } from "next/server";
import { auth } from "./auth";

type OrgSession =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; response: NextResponse };

export async function requireOrgSession(): Promise<OrgSession> {
  const session = await auth();

  if (!session?.user?.organizationId || !session.user.id) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { ok: true, organizationId: session.user.organizationId, userId: session.user.id };
}
