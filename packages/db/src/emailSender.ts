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

export function createEmailSender(): SendEmail {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? createResendSender(apiKey) : createNoopSender();
}
