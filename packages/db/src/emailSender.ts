import { Resend } from "resend";

export type SendEmailInput = { to: string; subject: string; body: string };
export type SendEmailResult = { ok: true } | { ok: false; error: string };
export type SendEmail = (input: SendEmailInput) => Promise<SendEmailResult>;

const FROM_ADDRESS = "MyTenants <notifications@mytenants.example>";

export function createNoopSender(): SendEmail {
  return async ({ to, subject }) => {
    console.log(`[email:noop] would send "${subject}" to ${to}`);
    return { ok: true };
  };
}

type ResendLikeClient = {
  emails: {
    send(args: { from: string; to: string; subject: string; text: string }): Promise<{
      data: { id: string } | null;
      error: { message: string; name: string } | null;
    }>;
  };
};

export function createResendSender(apiKey: string, client: ResendLikeClient = new Resend(apiKey)): SendEmail {
  return async ({ to, subject, body }) => {
    try {
      const result = await client.emails.send({ from: FROM_ADDRESS, to, subject, text: body });
      if (result.error) {
        return { ok: false, error: result.error.message };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unknown email send error" };
    }
  };
}

type SmtpConfig = { host: string; port: number; user: string; pass: string; from: string };

type SmtpLikeTransport = {
  sendMail(args: { from: string; to: string; subject: string; text: string }): Promise<unknown>;
};

export function createSmtpSender(config: SmtpConfig, transport?: SmtpLikeTransport): SendEmail {
  return async ({ to, subject, body }) => {
    try {
      // Lazily imported: nodemailer relies on Node core modules (net/tls/stream) that
      // don't exist in the Edge runtime that bundles this package's barrel export for
      // the auth middleware — a static top-level import breaks that bundle even though
      // the middleware never calls this function.
      const client = transport ?? (await import("nodemailer")).default.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: { user: config.user, pass: config.pass },
      });
      await client.sendMail({ from: config.from, to, subject, text: body });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unknown email send error" };
    }
  };
}

export function createEmailSender(): SendEmail {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpHost && smtpUser && smtpPass) {
    return createSmtpSender({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT) || 587,
      user: smtpUser,
      pass: smtpPass,
      from: process.env.SMTP_FROM?.trim() || `MyTenants <${smtpUser}>`,
    });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) return createResendSender(apiKey);

  return createNoopSender();
}
