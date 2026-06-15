import type { Prisma } from "@prisma/client";
/**
 * Move product-scoped rows from `fromProductId` onto `toProductId`, deleting on unique clashes.
 */
export default function repointProductForeignKeys(tx: Prisma.TransactionClient, fromProductId: bigint, toProductId: bigint): Promise<void>;
//# sourceMappingURL=repointProductForeignKeys.d.ts.map