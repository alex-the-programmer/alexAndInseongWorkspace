import { groupDuplicateBrands } from "../core/groupDuplicates.js";
import { isUnknownBrandName } from "../core/brandNormalize.js";
export async function auditBrandDuplicates(prisma, mode = "v1") {
    const brands = await prisma.brand.findMany({
        select: {
            id: true,
            name: true,
            _count: { select: { products: true } },
        },
        orderBy: { id: "asc" },
    });
    const eligible = brands
        .filter((b) => !isUnknownBrandName(b.name))
        .map((b) => ({
        id: b.id,
        name: b.name,
        productCount: b._count.products,
    }));
    const groups = groupDuplicateBrands(eligible, mode);
    const topGroups = groups.slice(0, 20).map((group) => ({
        normalizedName: group.normalizedName,
        kind: group.kind,
        totalProducts: group.totalProducts,
        members: group.members.map((m) => ({
            id: m.id.toString(),
            name: m.name,
            productCount: m.productCount,
        })),
    }));
    return {
        generatedAt: new Date().toISOString(),
        mode,
        totalBrands: brands.length,
        duplicateGroupCount: groups.length,
        caseOnlyGroupCount: groups.filter((g) => g.kind === "case_only").length,
        verbatimDuplicateGroupCount: groups.filter((g) => g.kind === "verbatim").length,
        whitespaceGroupCount: groups.filter((g) => g.kind === "whitespace").length,
        punctuationSpacingGroupCount: groups.filter((g) => g.kind === "punctuation_spacing").length,
        productsInDuplicateGroups: groups.reduce((sum, g) => sum + g.totalProducts, 0),
        topGroups,
    };
}
//# sourceMappingURL=auditBrandDuplicates.js.map