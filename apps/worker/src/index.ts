import cron from "node-cron";
import { prisma } from "@mytenants/db";
import { runDailyBilling } from "./billing";

cron.schedule("0 2 * * *", async () => {
  const runAt = new Date();
  // The callback is async, so an uncaught rejection here would crash the worker and
  // silently lose the day's run — keep every failure inside this try/catch.
  try {
    const result = await runDailyBilling(prisma, runAt);
    console.log(`Daily billing: generated ${result.generated} invoice(s), recalculated ${result.recalculated} status(es).`);
  } catch (error) {
    console.error(`Daily billing run for ${runAt.toISOString()} failed:`, error);
  }
});

console.log("worker started — daily billing scheduled at 02:00");
