export { default as executeBrandMerge, resolveBrandMergePlan } from "./mergeBrand.js";
export type { ExecuteBrandMergeParams, ExecuteBrandMergeResult } from "./mergeBrand.js";
export { default as executeProductMerge, resolveActiveProductId, loadProductMergeStats, pickCanonicalProduct, } from "./mergeProduct.js";
export { default as repointProductForeignKeys } from "./repointProductForeignKeys.js";
export { loadDedupBrandBuckets } from "./loadDedupBrandBuckets.js";
export { estimatePairwiseEdges, estimatePairwiseEdgesForBrand, } from "./estimatePairwiseEdges.js";
export type { PairwiseEstimateResult, PairwiseEstimateTotals, OyAbsentClusterSample, SellerPairEdgeCount, } from "./estimatePairwiseEdges.js";
export { mergeProductDedupClusters } from "./mergeProductDedupClusters.js";
export type { MergeProductDedupClustersResult } from "./mergeProductDedupClusters.js";
export { auditBrandDuplicates } from "./auditBrandDuplicates.js";
export type { BrandDedupReport } from "./auditBrandDuplicates.js";
export { auditProductDuplicates } from "./auditProductDuplicates.js";
export type { ProductDedupPairwiseCostReport } from "./auditProductDuplicates.js";
export { remapProductsToCanonicalCategories, type RemapProductsToCanonicalCategoriesResult, } from "./remapProductsToCanonicalCategories.js";
//# sourceMappingURL=index.d.ts.map