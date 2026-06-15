import {
  orderUndirectedPair,
  pickCanonicalBrand,
  pickCanonicalProduct,
} from "../pickCanonical.js";

describe("pickCanonicalProduct", () => {
  it("prefers more seller listings, then spec richness, then lowest id", () => {
    const root = pickCanonicalProduct([
      { id: 10n, sellerProductCount: 1, categoryId: 1n, specCount: 2 },
      { id: 5n, sellerProductCount: 3, categoryId: 2n, specCount: 1 },
      { id: 7n, sellerProductCount: 3, categoryId: 2n, specCount: 5 },
    ]);
    expect(root.id).toBe(7n);
  });

  it("breaks ties on seller count and spec count with lowest id", () => {
    const root = pickCanonicalProduct([
      { id: 10n, sellerProductCount: 2, categoryId: 1n, specCount: 4 },
      { id: 5n, sellerProductCount: 2, categoryId: 2n, specCount: 4 },
    ]);
    expect(root.id).toBe(5n);
  });
});

describe("pickCanonicalBrand", () => {
  it("returns the only member when product counts and ids tie", () => {
    const member = { id: 3n, name: "Laneige", productCount: 4 };
    expect(pickCanonicalBrand([member])).toEqual(member);
  });
});

describe("orderUndirectedPair", () => {
  it("orders bigint pairs ascending", () => {
    expect(orderUndirectedPair(5n, 2n)).toEqual([2n, 5n]);
    expect(orderUndirectedPair(2n, 5n)).toEqual([2n, 5n]);
  });
});
