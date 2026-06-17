import type { Prisma } from "@prisma/client";

/**
 * Move product-scoped rows from `fromProductId` onto `toProductId`, deleting on unique clashes.
 */
export default async function repointProductForeignKeys(
  tx: Prisma.TransactionClient,
  fromProductId: bigint,
  toProductId: bigint
): Promise<void> {
  if (fromProductId === toProductId) return;

  const secondarySpecs = await tx.productSellerSpec.findMany({
    where: { productId: fromProductId },
  });

  for (const row of secondarySpecs) {
    const existing = await tx.productSellerSpec.findUnique({
      where: {
        productId_sellerSpecId: {
          productId: toProductId,
          sellerSpecId: row.sellerSpecId,
        },
      },
    });
    if (!existing) {
      await tx.productSellerSpec.update({
        where: { id: row.id },
        data: { productId: toProductId },
      });
    } else {
      await tx.productSellerSpec.delete({ where: { id: row.id } });
    }
  }

  await tx.cartProduct.updateMany({
    where: { productId: fromProductId },
    data: { productId: toProductId },
  });

  await tx.orderProduct.updateMany({
    where: { productId: fromProductId },
    data: { productId: toProductId },
  });

  const couponLinks = await tx.couponProgramProduct.findMany({
    where: { productId: fromProductId },
  });
  for (const link of couponLinks) {
    const clash = await tx.couponProgramProduct.findUnique({
      where: {
        couponProgramId_productId: {
          couponProgramId: link.couponProgramId,
          productId: toProductId,
        },
      },
    });
    if (clash) {
      await tx.couponProgramProduct.delete({ where: { id: link.id } });
    } else {
      await tx.couponProgramProduct.update({
        where: { id: link.id },
        data: { productId: toProductId },
      });
    }
  }

  await tx.productReview.updateMany({
    where: { productId: fromProductId },
    data: { productId: toProductId },
  });

  const summaries = await tx.productReviewSummary.findMany({
    where: { productId: fromProductId },
  });
  for (const summary of summaries) {
    const clash = await tx.productReviewSummary.findUnique({
      where: {
        sellerId_productId: { sellerId: summary.sellerId, productId: toProductId },
      },
    });
    if (clash) {
      await tx.productReviewSummary.delete({ where: { id: summary.id } });
    } else {
      await tx.productReviewSummary.update({
        where: { id: summary.id },
        data: { productId: toProductId },
      });
    }
  }

  const sellerRows = await tx.sellerProduct.findMany({
    where: { productId: fromProductId },
  });
  for (const sp of sellerRows) {
    const clash = await tx.sellerProduct.findUnique({
      where: {
        sellerId_productId_packAmount_packUnit_packCount: {
          sellerId: sp.sellerId,
          productId: toProductId,
          packAmount: sp.packAmount,
          packUnit: sp.packUnit,
          packCount: sp.packCount,
        },
      },
    });
    if (clash) {
      await tx.sellerProductPrice.deleteMany({ where: { sellerProductId: sp.id } });
      await tx.sellerProduct.delete({ where: { id: sp.id } });
    } else {
      await tx.sellerProduct.update({
        where: { id: sp.id },
        data: { productId: toProductId },
      });
    }
  }
}
