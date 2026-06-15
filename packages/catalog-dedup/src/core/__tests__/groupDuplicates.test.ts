import {
  buildComponentsFromEdges,
  sellerPairKey,
  UnionFind,
} from "../groupDuplicates.js";
import { estimatePairwiseEdgesForBrand } from "../../bulk/estimatePairwiseEdges.js";

describe("UnionFind", () => {
  it("merges transitive components", () => {
    const uf = new UnionFind();
    uf.union("1", "2");
    uf.union("2", "3");
    expect(uf.find("1")).toBe(uf.find("3"));
    expect(uf.components().size).toBe(1);
  });
});

describe("sellerPairKey", () => {
  it("is order-independent", () => {
    expect(sellerPairKey(5n, 9n)).toBe(sellerPairKey(9n, 5n));
  });
});

describe("buildComponentsFromEdges", () => {
  it("returns connected components only", () => {
    const components = buildComponentsFromEdges([
      [1n, 2n],
      [2n, 3n],
      [9n, 10n],
    ]);
    expect(components).toHaveLength(2);
    expect(components.map((c) => c.length).sort()).toEqual([2, 3]);
  });
});

describe("estimatePairwiseEdgesForBrand", () => {
  it("counts OY-absent multi-seller clusters", () => {
    const { edges } = estimatePairwiseEdgesForBrand({
      products: [
        { id: 1n, name: "COSRX Snail 96 Mucin Power Essence 100ml", sellerIds: [10n] },
        { id: 2n, name: "COSRX Snail 96 Mucin Power Essence 100 ml", sellerIds: [20n] },
        { id: 3n, name: "COSRX Snail 96 Mucin Power Essence 100ml", sellerIds: [30n] },
      ],
      sellerNamesById: new Map([
        ["10", "Peach & Lily"],
        ["20", "Soko Glam"],
        ["30", "COSRX US"],
      ]),
      minOverlap: 2,
      maxCounterpartsPerProduct: 25,
    });

    expect(edges.length).toBeGreaterThan(0);
    const components = buildComponentsFromEdges(edges);
    expect(components.some((c) => c.length >= 3)).toBe(true);
  });

  it("skips self-pairs for products listed on multiple sellers", () => {
    const { edges } = estimatePairwiseEdgesForBrand({
      products: [
        {
          id: 1n,
          name: "Laneige Lip Sleeping Mask Berry",
          sellerIds: [10n, 20n],
        },
        {
          id: 2n,
          name: "Laneige Lip Sleeping Mask Berry",
          sellerIds: [20n],
        },
      ],
      sellerNamesById: new Map([
        ["10", "Olive Young Global"],
        ["20", "Style Korean"],
      ]),
      minOverlap: 2,
      maxCounterpartsPerProduct: 25,
    });

    expect(edges).toHaveLength(1);
  });
});
