import type { PrismaClient } from "@prisma/client";
import type { BrandDedupMode, DuplicateBrandGroup } from "../core/types.js";
export type BrandDedupReport = {
    generatedAt: string;
    mode: BrandDedupMode;
    totalBrands: number;
    duplicateGroupCount: number;
    caseOnlyGroupCount: number;
    verbatimDuplicateGroupCount: number;
    whitespaceGroupCount: number;
    punctuationSpacingGroupCount: number;
    productsInDuplicateGroups: number;
    topGroups: Array<{
        normalizedName: string;
        kind: DuplicateBrandGroup["kind"];
        totalProducts: number;
        members: Array<{
            id: string;
            name: string;
            productCount: number;
        }>;
    }>;
};
export declare function auditBrandDuplicates(prisma: PrismaClient, mode?: BrandDedupMode): Promise<BrandDedupReport>;
//# sourceMappingURL=auditBrandDuplicates.d.ts.map