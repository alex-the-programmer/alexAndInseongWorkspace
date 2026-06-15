import { pickCanonicalBrand, pickDisplayBrandName } from "../core/groupDuplicates.js";
export function resolveBrandMergePlan(members) {
    const canonical = pickCanonicalBrand(members);
    const duplicateBrandIds = members.filter((m) => m.id !== canonical.id).map((m) => m.id);
    const displayName = pickDisplayBrandName(members, canonical);
    return {
        canonicalBrandId: canonical.id,
        duplicateBrandIds,
        displayName,
    };
}
export default async function executeBrandMerge(prisma, params) {
    const { canonicalBrandId, duplicateBrandIds, displayName } = params;
    const uniqueDuplicates = [...new Set(duplicateBrandIds.map(String))].map((id) => BigInt(id));
    const duplicates = uniqueDuplicates.filter((id) => id !== canonicalBrandId);
    if (duplicates.length === 0) {
        throw new Error("executeBrandMerge: no duplicate brand ids to merge");
    }
    const canonical = await prisma.brand.findUnique({ where: { id: canonicalBrandId } });
    if (!canonical) {
        throw new Error(`Canonical brand not found: ${canonicalBrandId}`);
    }
    const members = await prisma.brand.findMany({
        where: { id: { in: [canonicalBrandId, ...duplicates] } },
        select: { id: true, name: true, _count: { select: { products: true } } },
    });
    const membersWithCounts = members.map((m) => ({
        id: m.id,
        name: m.name,
        productCount: m._count.products,
    }));
    const canonicalMember = membersWithCounts.find((m) => m.id === canonicalBrandId);
    if (!canonicalMember) {
        throw new Error(`Canonical brand not found in merge set: ${canonicalBrandId}`);
    }
    const resolvedDisplayName = displayName ?? pickDisplayBrandName(membersWithCounts, canonicalMember);
    await prisma.$transaction(async (tx) => {
        for (const duplicateId of duplicates) {
            await tx.product.updateMany({
                where: { brandId: duplicateId },
                data: { brandId: canonicalBrandId },
            });
            const chatLinks = await tx.chatConsideredBrand.findMany({
                where: { brandId: duplicateId },
            });
            for (const link of chatLinks) {
                const clash = await tx.chatConsideredBrand.findUnique({
                    where: {
                        chatId_brandId: {
                            chatId: link.chatId,
                            brandId: canonicalBrandId,
                        },
                    },
                });
                if (clash) {
                    await tx.chatConsideredBrand.delete({ where: { id: link.id } });
                }
                else {
                    await tx.chatConsideredBrand.update({
                        where: { id: link.id },
                        data: { brandId: canonicalBrandId },
                    });
                }
            }
            const couponPrograms = await tx.couponProgram.findMany({
                where: { brandId: duplicateId },
            });
            for (const program of couponPrograms) {
                await tx.couponProgram.update({
                    where: { id: program.id },
                    data: { brandId: canonicalBrandId },
                });
            }
            await tx.brand.delete({ where: { id: duplicateId } });
        }
        if (resolvedDisplayName !== canonical.name) {
            await tx.brand.update({
                where: { id: canonicalBrandId },
                data: { name: resolvedDisplayName },
            });
        }
    });
    return {
        canonicalBrandId,
        mergedBrandIds: duplicates,
        displayName: resolvedDisplayName,
    };
}
//# sourceMappingURL=mergeBrand.js.map