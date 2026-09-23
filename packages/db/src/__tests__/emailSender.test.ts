import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";

vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn().mockReturnValue({ sendMail: vi.fn().mockResolvedValue({}) }) },
}));

import { createNoopSender, createResendSender, createSmtpSender, createEmailSender } from "../emailSender";

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

describe("createSmtpSender", () => {
  it("returns ok:true when the injected transport's sendMail succeeds", async () => {
    const fakeTransport = { sendMail: vi.fn().mockResolvedValue({ messageId: "abc" }) };
    const sender = createSmtpSender(
      { host: "smtp.gmail.com", port: 587, user: "me@gmail.com", pass: "app-password", from: "MyTenants <me@gmail.com>" },
      fakeTransport
    );

    const result = await sender({ to: "jane@example.com", subject: "Hi", body: "Hello!" });

    expect(result).toEqual({ ok: true });
    expect(fakeTransport.sendMail).toHaveBeenCalledWith({
      from: "MyTenants <me@gmail.com>",
      to: "jane@example.com",
      subject: "Hi",
      text: "Hello!",
    });
  });

  it("returns ok:false with a message when the injected transport throws", async () => {
    const fakeTransport = { sendMail: vi.fn().mockRejectedValue(new Error("auth failed")) };
    const sender = createSmtpSender(
      { host: "smtp.gmail.com", port: 587, user: "me@gmail.com", pass: "wrong-password", from: "me@gmail.com" },
      fakeTransport
    );

    const result = await sender({ to: "jane@example.com", subject: "Hi", body: "Hello!" });

    expect(result).toEqual({ ok: false, error: "auth failed" });
  });
});

describe("createEmailSender", () => {
  const originalEnv = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
  };

  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("returns a working no-op sender when nothing is configured", async () => {
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

  it("returns a function without making any network call when SMTP_* is set", () => {
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "me@gmail.com";
    process.env.SMTP_PASS = "app-password";

    const sender = createEmailSender();

    expect(typeof sender).toBe("function");
  });

  it("prefers SMTP over Resend when both are configured", async () => {
    vi.mocked(nodemailer.createTransport).mockClear();
    process.env.RESEND_API_KEY = "fake-key";
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "me@gmail.com";
    process.env.SMTP_PASS = "app-password";

    const sender = createEmailSender();
    await sender({ to: "jane@example.com", subject: "Hi", body: "Hello!" });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.gmail.com", auth: { user: "me@gmail.com", pass: "app-password" } })
    );
  });
});
