import {
  isUnknownBrandName,
  normalizeBrandName,
  normalizeBrandNameAggressive,
  UNKNOWN_BRAND_NAME,
} from "../brandNormalize.js";

describe("normalizeBrandName", () => {
  it("trims, collapses whitespace, and lowercases", () => {
    expect(normalizeBrandName("  COSRX   Official  ")).toBe("cosrx official");
  });

  it("treats unknown brand consistently", () => {
    expect(isUnknownBrandName(UNKNOWN_BRAND_NAME)).toBe(true);
    expect(isUnknownBrandName(" unknown brand ")).toBe(true);
    expect(isUnknownBrandName("COSRX")).toBe(false);
  });
});

describe("normalizeBrandNameAggressive", () => {
  it("strips punctuation and whitespace", () => {
    expect(normalizeBrandNameAggressive("AGE 20's")).toBe("age20s");
    expect(normalizeBrandNameAggressive("AGE20'S")).toBe("age20s");
    expect(normalizeBrandNameAggressive("AMPLE:N")).toBe("amplen");
    expect(normalizeBrandNameAggressive("K-POP")).toBe("kpop");
    expect(normalizeBrandNameAggressive("Dr.Jart+")).toBe("drjart");
  });

  it("does not merge distinct brands that share a prefix", () => {
    expect(normalizeBrandNameAggressive("Alive")).not.toBe(normalizeBrandNameAggressive("ALIVE LAB"));
    expect(normalizeBrandNameAggressive("AMUSE")).not.toBe(normalizeBrandNameAggressive("AMUSEDew"));
  });
});
