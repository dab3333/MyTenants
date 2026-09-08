import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createNoopSender, createResendSender, createEmailSender } from "../emailSender";

describe("createNoopSender", () => {
  it("logs the would-be send and returns ok:true without any network call", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const sender = createNoopSender();

    const result = await sender({ to: "jane@example.com", subject: "Hi", body: "Hello!" });

    expect(result).toEqual({ ok: true });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("jane@example.com"));
    logSpy.mockRestore();
  });
});

describe("createResendSender", () => {
  it("returns ok:true when the injected client's send succeeds", async () => {
    const fakeClient = { emails: { send: vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null }) } };
    const sender = createResendSender("fake-api-key", fakeClient);

    const result = await sender({ to: "jane@example.com", subject: "Hi", body: "Hello!" });

    expect(result).toEqual({ ok: true });
    expect(fakeClient.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "jane@example.com", subject: "Hi" })
    );
  });

  it("returns ok:false with the provider's message when the injected client reports an error", async () => {
    const fakeClient = {
      emails: { send: vi.fn().mockResolvedValue({ data: null, error: { message: "Invalid API key", name: "validation_error" } }) },
    };
    const sender = createResendSender("fake-api-key", fakeClient);

    const result = await sender({ to: "jane@example.com", subject: "Hi", body: "Hello!" });

    expect(result).toEqual({ ok: false, error: "Invalid API key" });
  });

  it("returns ok:false with a message when the injected client throws", async () => {
    const fakeClient = { emails: { send: vi.fn().mockRejectedValue(new Error("network down")) } };
    const sender = createResendSender("fake-api-key", fakeClient);

    const result = await sender({ to: "jane@example.com", subject: "Hi", body: "Hello!" });

    expect(result).toEqual({ ok: false, error: "network down" });
  });
});

describe("createEmailSender", () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
  });

  it("returns a working no-op sender when RESEND_API_KEY is unset", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const sender = createEmailSender();

    const result = await sender({ to: "jane@example.com", subject: "Hi", body: "Hello!" });

    expect(result).toEqual({ ok: true });
    logSpy.mockRestore();
  });

  it("returns a function without making any network call when RESEND_API_KEY is set", () => {
    process.env.RESEND_API_KEY = "fake-key-for-factory-selection-only";

    const sender = createEmailSender();

    expect(typeof sender).toBe("function");
  });
});
