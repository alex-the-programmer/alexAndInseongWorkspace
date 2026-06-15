import { groupDuplicateBrands } from "../groupDuplicates.js";
import {
  classifyDuplicateGroup,
  pickCanonicalBrand,
  pickDisplayBrandName,
} from "../pickCanonical.js";

describe("groupDuplicateBrands", () => {
  it("groups case-only duplicates", () => {
    const groups = groupDuplicateBrands([
      { id: 1n, name: "COSRX", productCount: 10 },
      { id: 2n, name: "cosrx", productCount: 3 },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.normalizedName).toBe("cosrx");
    expect(groups[0]?.kind).toBe("case_only");
  });

  it("groups whitespace-normalized duplicates", () => {
    const groups = groupDuplicateBrands([
      { id: 1n, name: "Laneige", productCount: 1 },
      { id: 2n, name: "  Laneige  ", productCount: 2 },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe("whitespace");
  });

  it("groups punctuation/spacing variants in v2 mode", () => {
    const groups = groupDuplicateBrands(
      [
        { id: 1n, name: "AGE 20's", productCount: 5 },
        { id: 2n, name: "AGE20'S", productCount: 2 },
        { id: 3n, name: "AMPLE:N", productCount: 1 },
        { id: 4n, name: "AMPLE N", productCount: 3 },
      ],
      "v2"
    );

    expect(groups).toHaveLength(2);
    const ageGroup = groups.find((g) => g.normalizedName === "age20s");
    expect(ageGroup?.kind).toBe("punctuation_spacing");
    expect(ageGroup?.members).toHaveLength(2);

    const ampleGroup = groups.find((g) => g.normalizedName === "amplen");
    expect(ampleGroup?.kind).toBe("punctuation_spacing");
    expect(ampleGroup?.members).toHaveLength(2);
  });

  it("does not group brands with different aggressive keys in v2 mode", () => {
    const groups = groupDuplicateBrands(
      [
        { id: 1n, name: "Alive", productCount: 1 },
        { id: 2n, name: "ALIVE LAB", productCount: 2 },
        { id: 3n, name: "AMUSE", productCount: 3 },
        { id: 4n, name: "AMUSEDew", productCount: 4 },
      ],
      "v2"
    );

    expect(groups).toHaveLength(0);
  });
});

describe("pickCanonicalBrand", () => {
  it("prefers the brand with more products, then lowest id", () => {
    const members = [
      { id: 5n, name: "COSRX", productCount: 2 },
      { id: 2n, name: "cosrx", productCount: 10 },
      { id: 8n, name: "Cosrx", productCount: 10 },
    ];

    expect(pickCanonicalBrand(members).id).toBe(2n);
  });
});

describe("pickDisplayBrandName", () => {
  it("prefers stronger casing when product counts tie", () => {
    const members = [
      { id: 1n, name: "cosrx", productCount: 5 },
      { id: 2n, name: "COSRX", productCount: 5 },
    ];
    const canonical = pickCanonicalBrand(members);

    expect(pickDisplayBrandName(members, canonical)).toBe("COSRX");
  });
});

describe("classifyDuplicateGroup", () => {
  it("detects verbatim duplicates", () => {
    expect(
      classifyDuplicateGroup([
        { id: 1n, name: "Innisfree", productCount: 1 },
        { id: 2n, name: "Innisfree", productCount: 2 },
      ])
    ).toBe("verbatim");
  });
});

describe("golden v2 brand grouping fixture", () => {
  it("matches expected group structure for known punctuation variants", () => {
    const groups = groupDuplicateBrands(
      [
        { id: 1n, name: "AGE 20's", productCount: 5 },
        { id: 2n, name: "AGE20'S", productCount: 2 },
      ],
      "v2"
    );

    expect(groups).toEqual([
      expect.objectContaining({
        normalizedName: "age20s",
        kind: "punctuation_spacing",
        totalProducts: 7,
        members: expect.arrayContaining([
          expect.objectContaining({ id: 1n }),
          expect.objectContaining({ id: 2n }),
        ]),
      }),
    ]);
  });
});
