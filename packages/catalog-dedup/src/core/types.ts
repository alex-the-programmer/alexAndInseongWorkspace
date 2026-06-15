export type BrandDedupMode = "v1" | "v2";

export type BrandWithProductCount = {
  id: bigint;
  name: string;
  productCount: number;
};

export type DuplicateBrandGroup = {
  normalizedName: string;
  members: BrandWithProductCount[];
  kind: "verbatim" | "case_only" | "whitespace" | "punctuation_spacing";
  totalProducts: number;
};

export type ProductMergeStats = {
  id: bigint;
  sellerProductCount: number;
  categoryId: bigint;
  specCount: number;
};

export type DedupProduct = {
  id: bigint;
  name: string;
  sellerIds: bigint[];
};

export type DedupBrandBucket = {
  brandId: bigint;
  brandName: string;
  products: DedupProduct[];
};
