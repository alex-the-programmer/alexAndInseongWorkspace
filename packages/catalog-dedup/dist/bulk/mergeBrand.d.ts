import type { PrismaClient } from "@prisma/client";
import type { BrandWithProductCount } from "../core/types.js";
export type ExecuteBrandMergeParams = {
    canonicalBrandId: bigint;
    duplicateBrandIds: bigint[];
    displayName?: string;
};
export type ExecuteBrandMergeResult = {
    canonicalBrandId: bigint;
    mergedBrandIds: bigint[];
    displayName: string;
};
export declare function resolveBrandMergePlan(members: BrandWithProductCount[]): {
    canonicalBrandId: bigint;
    duplicateBrandIds: bigint[];
    displayName: string;
};
export default function executeBrandMerge(prisma: PrismaClient, params: ExecuteBrandMergeParams): Promise<ExecuteBrandMergeResult>;
//# sourceMappingURL=mergeBrand.d.ts.map