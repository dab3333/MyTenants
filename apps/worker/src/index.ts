import cron from "node-cron";
import { prisma } from "@mytenants/db";
import { runDailyBilling } from "./billing";

cron.schedule("0 2 * * *", async () => {
  const result = await runDailyBilling(prisma, new Date());
  console.log(`Daily billing: generated ${result.generated} invoice(s), recalculated ${result.recalculated} status(es).`);
});

console.log("worker started — daily billing scheduled at 02:00");
