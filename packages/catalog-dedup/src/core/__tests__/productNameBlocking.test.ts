import {
  isBlockedPair,
  significantTokens,
  tokenOverlapCount,
} from "../productNameBlocking.js";

describe("significantTokens", () => {
  it("filters stop words and short tokens", () => {
    const tokens = significantTokens("The New SPF 50 ml Set");
    expect(tokens.has("the")).toBe(false);
    expect(tokens.has("new")).toBe(false);
    expect(tokens.has("spf")).toBe(false);
    expect(tokens.has("ml")).toBe(false);
    expect(tokens.has("set")).toBe(false);
  });

  it("includes Hangul tokens of length >= 3", () => {
    const tokens = significantTokens("이니스프리 그린티 세럼");
    expect(tokens.has("이니스프리")).toBe(true);
    expect(tokens.has("그린티")).toBe(true);
    // "세럼" is only 2 code points — below the 3-char minimum
    expect(tokens.has("세럼")).toBe(false);
  });
});

describe("tokenOverlapCount", () => {
  it("counts shared significant tokens", () => {
    const a = "COSRX Advanced Snail 96 Mucin Power Essence";
    const b = "COSRX Snail 96 Mucin Power Essence 100ml";
    expect(tokenOverlapCount(a, b)).toBeGreaterThanOrEqual(4);
  });
});

describe("isBlockedPair", () => {
  it("matches known cross-retailer true positives", () => {
    expect(
      isBlockedPair(
        "COSRX Advanced Snail 96 Mucin Power Essence 100ml",
        "COSRX Snail 96 Mucin Power Essence 100 ml",
        2
      )
    ).toBe(true);

    expect(
      isBlockedPair(
        "Laneige Lip Sleeping Mask Berry",
        "Laneige Lip Sleeping Mask Berry",
        2
      )
    ).toBe(true);
  });

  it("does not match distinct products that share only brand tokens", () => {
    expect(
      isBlockedPair(
        "COSRX Low pH Good Morning Gel Cleanser 150ml",
        "COSRX Acne Pimple Master Patch 24ea",
        2
      )
    ).toBe(false);
  });

  it("uses 12-char prefix branch for long similar names", () => {
    expect(
      isBlockedPair(
        "Some Very Long Product Name Alpha",
        "Some Very Long Product Name Beta",
        99
      )
    ).toBe(true);
  });

  it("returns false when overlap is below threshold and names are short", () => {
    expect(isBlockedPair("ABC", "XYZ", 2)).toBe(false);
  });

  it("matches promo-prefixed names to base titles when brand is provided", () => {
    expect(
      isBlockedPair(
        "[BOGO] COSRX Pure Fit Cica Cream 50ml",
        "COSRX Pure Fit Cica Cream 50ml",
        2,
        { brandA: "COSRX", brandB: "COSRX" }
      )
    ).toBe(true);
  });

  it("matches brand-redundant titles after normalization", () => {
    expect(
      isBlockedPair(
        "COSRX Advanced Snail 96 Mucin Power Essence 100ml",
        "Advanced Snail 96 Mucin Power Essence 100ml",
        2,
        { brandA: "COSRX", brandB: "COSRX" }
      )
    ).toBe(true);
  });

  it("matches titles that differ only by trailing pack size", () => {
    expect(
      isBlockedPair(
        "Dear, Klairs Freshly Juiced Vitamin E Mask 15g",
        "Dear, Klairs Freshly Juiced Vitamin E Mask 90g",
        2,
        { brandA: "Dear, Klairs", brandB: "Dear, Klairs" }
      )
    ).toBe(true);
  });
});
