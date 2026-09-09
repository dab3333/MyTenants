import cron from "node-cron";
import { prisma, createEmailSender } from "@mytenants/db";
import { runDailyBilling } from "./billing";
import { runOverdueReminders } from "./reminders";

const sendEmail = createEmailSender();

cron.schedule("0 2 * * *", async () => {
  const runAt = new Date();
  // The callback is async, so an uncaught rejection here would crash the worker and
  // silently lose the day's run — keep every failure inside its own try/catch, so a
  // failure in one step (billing or reminders) never blocks the other.
  try {
    const result = await runDailyBilling(prisma, runAt);
    console.log(`Daily billing: generated ${result.generated} invoice(s), recalculated ${result.recalculated} status(es).`);
  } catch (error) {
    console.error(`Daily billing run for ${runAt.toISOString()} failed:`, error);
  }

  try {
    const reminderResult = await runOverdueReminders(prisma, sendEmail, runAt);
    console.log(
      `Overdue reminders: sent ${reminderResult.sent}, skipped ${reminderResult.skippedNoEmail} (no email), skipped ${reminderResult.skippedRecentlyReminded} (recently reminded).`
    );
  } catch (error) {
    console.error(`Overdue reminders run for ${runAt.toISOString()} failed:`, error);
  }
});

console.log("worker started — daily billing scheduled at 02:00");
