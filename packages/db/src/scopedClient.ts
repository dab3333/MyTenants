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
const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);

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

          // Prisma's $allOperations hook types `args` as a union across every
          // model x operation in the schema, which TypeScript cannot narrow
          // based on the runtime `operation` string checks below. This local
          // view is a type-level cast only (same underlying object as `args`,
          // not a copy), so mutations here still reach the `query(args)` call.
          const mutableArgs = args as {
            where?: Record<string, unknown>;
            data?: unknown;
            create?: Record<string, unknown>;
            update?: Record<string, unknown>;
          };

          if (READ_OPS.has(operation) || WRITE_WHERE_OPS.has(operation) || operation === "upsert") {
            mutableArgs.where = { ...(mutableArgs.where ?? {}), organizationId };
          }

          if (CREATE_OPS.has(operation)) {
            if (operation === "create") {
              mutableArgs.data = { ...((mutableArgs.data as Record<string, unknown>) ?? {}), organizationId };
            } else {
              mutableArgs.data = Array.isArray(mutableArgs.data)
                ? mutableArgs.data.map((row: Record<string, unknown>) => ({ ...row, organizationId }))
                : { ...((mutableArgs.data as Record<string, unknown>) ?? {}), organizationId };
            }
          }

          if (operation === "upsert") {
            mutableArgs.create = { ...(mutableArgs.create ?? {}), organizationId };
            mutableArgs.update = { ...(mutableArgs.update ?? {}), organizationId };
          }

          return query(args);
        },
      },
    },
  });
}
