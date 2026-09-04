import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../auth", () => ({ auth: vi.fn() }));

import { auth } from "../auth";
import { requireOrgSession } from "../requireOrgSession";

describe("requireOrgSession", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns ok:false with a 401 response when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await requireOrgSession();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("returns ok:false with a 401 response when the session has no organizationId", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as never);

    const result = await requireOrgSession();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("returns ok:true with organizationId and userId when a valid session exists", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { organizationId: "org-1", id: "user-1", role: "OWNER" },
    } as never);

    const result = await requireOrgSession();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.organizationId).toBe("org-1");
      expect(result.userId).toBe("user-1");
    }
  });
});
