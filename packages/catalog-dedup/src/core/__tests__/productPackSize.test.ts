import {
  PackUnit,
  formatPackSizeLabel,
  parsePackSizeFromTitle,
  stripPackSizeForDedup,
} from "../productPackSize.js";

describe("parsePackSizeFromTitle", () => {
  it("parses trailing mg and ml", () => {
    expect(parsePackSizeFromTitle("Vitamin C Serum 500mg")).toMatchObject({
      baseName: "Vitamin C Serum",
      packAmount: 500,
      packUnit: PackUnit.MG,
      packCount: 1,
    });
    expect(parsePackSizeFromTitle("COSRX Snail Essence 100ml")).toMatchObject({
      baseName: "COSRX Snail Essence",
      packAmount: 100,
      packUnit: PackUnit.ML,
    });
  });

  it("parses capsule and tablet counts", () => {
    expect(parsePackSizeFromTitle("Probiotic 10 Capsules")).toMatchObject({
      baseName: "Probiotic",
      packAmount: 10,
      packUnit: PackUnit.CAPSULE,
    });
    expect(parsePackSizeFromTitle("Multivitamin - 30 tablets")).toMatchObject({
      baseName: "Multivitamin",
      packAmount: 30,
      packUnit: PackUnit.TABLET,
    });
  });

  it("parses compound multipacks", () => {
    expect(parsePackSizeFromTitle("Sheet Mask 30g x 5")).toMatchObject({
      baseName: "Sheet Mask",
      packAmount: 30,
      packUnit: PackUnit.G,
      packCount: 5,
    });
  });

  it("does not strip SPF values", () => {
    const parsed = parsePackSizeFromTitle("Sun Stick SPF50+ PA++++ 22g");
    expect(parsed.baseName).toBe("Sun Stick SPF50+ PA++++ 22g");
    expect(parsed.packUnit).toBe(PackUnit.UNKNOWN);
  });

  it("leaves product-line numbers in the base name", () => {
    expect(parsePackSizeFromTitle("ROUND LAB 1025 Dokdo Cleanser 150ml")).toMatchObject({
      baseName: "ROUND LAB 1025 Dokdo Cleanser",
      packAmount: 150,
      packUnit: PackUnit.ML,
    });
    expect(parsePackSizeFromTitle("COSRX Advanced Snail 96 Mucin Power Essence 100ml")).toMatchObject({
      baseName: "COSRX Advanced Snail 96 Mucin Power Essence",
      packAmount: 100,
      packUnit: PackUnit.ML,
    });
  });

  it("returns UNKNOWN when no trailing pack suffix is found", () => {
    expect(parsePackSizeFromTitle("Hydrating Toner")).toMatchObject({
      baseName: "Hydrating Toner",
      packUnit: PackUnit.UNKNOWN,
      packAmount: 0,
    });
  });
});

describe("stripPackSizeForDedup", () => {
  it("groups size variants to the same base name", () => {
    expect(stripPackSizeForDedup("Vitamin C Serum 500mg")).toBe("Vitamin C Serum");
    expect(stripPackSizeForDedup("Vitamin C Serum 1000mg")).toBe("Vitamin C Serum");
  });
});

describe("formatPackSizeLabel", () => {
  it("formats simple and compound labels", () => {
    expect(
      formatPackSizeLabel({ packAmount: 500, packUnit: PackUnit.MG, packCount: 1 })
    ).toBe("500 mg");
    expect(
      formatPackSizeLabel({ packAmount: 30, packUnit: PackUnit.G, packCount: 5 })
    ).toBe("30 g × 5");
  });
});
