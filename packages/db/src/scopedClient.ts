import { prisma } from "./index";

const SCOPED_MODELS = new Set([
  "user",
  "building",
  "floor",
  "room",
  "tenant",
  "tenancy",
  "invoice",
  "payment",
  "notification",
  "notificationRecipient",
]);

const READ_OPS = new Set(["findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"]);
const WRITE_WHERE_OPS = new Set(["update", "updateMany", "delete", "deleteMany"]);
const CREATE_OPS = new Set(["create", "createMany"]);

export function createScopedClient(organizationId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
          if (!SCOPED_MODELS.has(modelKey)) {
            return query(args);
          }

          if (operation === "findUnique" || operation === "findUniqueOrThrow") {
            throw new Error(
              `findUnique is not allowed on org-scoped models (model: ${model}). Use findFirst/findFirstOrThrow with an explicit id filter instead.`
            );
          }

          if (READ_OPS.has(operation) || WRITE_WHERE_OPS.has(operation)) {
            args.where = { ...(args.where ?? {}), organizationId };
          }

          if (CREATE_OPS.has(operation)) {
            if (operation === "create") {
              args.data = { ...(args.data ?? {}), organizationId };
            } else {
              args.data = Array.isArray(args.data)
                ? args.data.map((row: Record<string, unknown>) => ({ ...row, organizationId }))
                : args.data;
            }
          }

          return query(args);
        },
      },
    },
  });
}
