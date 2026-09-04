import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@mytenants/db";
import { POST, validateSignupBody } from "../route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("validateSignupBody", () => {
  it("returns null when all fields are present non-empty strings", () => {
    expect(
      validateSignupBody({
        organizationName: "Sunrise Dorms",
        ownerName: "Alex Cruz",
        email: "alex@example.com",
        password: "correct horse battery staple",
      })
    ).toBeNull();
  });

  it.each([
    ["organizationName", { ownerName: "Alex", email: "a@example.com", password: "password12345" }],
    ["ownerName", { organizationName: "Org", email: "a@example.com", password: "password12345" }],
    ["email", { organizationName: "Org", ownerName: "Alex", password: "password12345" }],
    ["password", { organizationName: "Org", ownerName: "Alex", email: "a@example.com" }],
  ])("reports %s as required when missing", (field, body) => {
    expect(validateSignupBody(body)).toBe(`${field} is required`);
  });

  it("reports a field as required when it is an empty string", () => {
    expect(
      validateSignupBody({
        organizationName: "",
        ownerName: "Alex",
        email: "a@example.com",
        password: "password12345",
      })
    ).toBe("organizationName is required");
  });

  it("reports a field as required when it is the wrong type", () => {
    expect(
      validateSignupBody({
        organizationName: "Org",
        ownerName: "Alex",
        email: "a@example.com",
        password: 12345,
      })
    ).toBe("password is required");
  });
});

describe("POST /api/signup", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns 400 with a clear message and never calls registerOrganization when a field is missing", async () => {
    const res = await POST(
      makeRequest({
        ownerName: "Alex Cruz",
        email: "missing-org@example.com",
        password: "password12345",
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toEqual({ error: "organizationName is required" });

    // Confirm registerOrganization was never reached: no user was created for this email.
    const user = await prisma.user.findFirst({ where: { email: "missing-org@example.com" } });
    expect(user).toBeNull();
  });

  it("still returns registerOrganization's own duplicate-email message unchanged", async () => {
    const email = `dup-route-${Date.now()}@example.com`;
    const first = await POST(
      makeRequest({
        organizationName: "Org One",
        ownerName: "Owner One",
        email,
        password: "password12345",
      })
    );
    expect(first.status).toBe(201);

    const second = await POST(
      makeRequest({
        organizationName: "Org Two",
        ownerName: "Owner Two",
        email,
        password: "password12345",
      })
    );
    expect(second.status).toBe(400);
    const data = await second.json();
    expect(data.error).toMatch(/already/i);
  });
});
