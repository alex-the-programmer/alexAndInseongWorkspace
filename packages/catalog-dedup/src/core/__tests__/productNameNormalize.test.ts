import {
  canonicalProductBaseName,
  decodeHtmlEntities,
  isPromoBracketTag,
  normalizeProductNameForDedup,
  normalizeProductTitle,
  stripPromotionalPrefixes,
  stripSellerBrandPrefix,
} from "../productNameNormalize.js";

describe("decodeHtmlEntities", () => {
  it("decodes common entities", () => {
    expect(decodeHtmlEntities("Mary&amp;May Serum")).toBe("Mary&May Serum");
    expect(decodeHtmlEntities("It&#39;s Skin")).toBe("It's Skin");
  });
});

describe("isPromoBracketTag", () => {
  it("allows promo tags", () => {
    expect(isPromoBracketTag("BOGO")).toBe(true);
    expect(isPromoBracketTag("💗BOGO")).toBe(true);
    expect(isPromoBracketTag("🌊TIME DEAL")).toBe(true);
    expect(isPromoBracketTag("OY Exclusive")).toBe(true);
    expect(isPromoBracketTag("1+1")).toBe(true);
  });

  it("rejects channel and collab tags", () => {
    expect(isPromoBracketTag("K-POP")).toBe(false);
    expect(isPromoBracketTag("DAISO")).toBe(false);
    expect(isPromoBracketTag("MD")).toBe(false);
    expect(isPromoBracketTag("MOOMIN EDITION")).toBe(false);
  });
});

describe("stripPromotionalPrefixes", () => {
  it("strips leading promo bracket tags", () => {
    expect(stripPromotionalPrefixes("[BOGO] Mary&May Retinol Serum 80ml")).toBe(
      "Mary&May Retinol Serum 80ml"
    );
    expect(stripPromotionalPrefixes("[💗BOGO] SKIN1004 Madagascar Centella Ampoule 100ml")).toBe(
      "SKIN1004 Madagascar Centella Ampoule 100ml"
    );
    expect(stripPromotionalPrefixes("[🌊TIME DEAL] PURITO Oat-in Calming Gel Cream 100ml")).toBe(
      "PURITO Oat-in Calming Gel Cream 100ml"
    );
  });

  it("strips asterisk promo markers", () => {
    expect(stripPromotionalPrefixes("*NEW* Abib Quick Sun Stick 22g")).toBe(
      "Abib Quick Sun Stick 22g"
    );
  });

  it("keeps channel tags and inline shade brackets", () => {
    expect(stripPromotionalPrefixes("[K-POP] ATEEZ Acrylic Pendant")).toBe(
      "[K-POP] ATEEZ Acrylic Pendant"
    );
    expect(stripPromotionalPrefixes("LINDSAY Modeling Mask 28g [Charcoal]")).toBe(
      "LINDSAY Modeling Mask 28g [Charcoal]"
    );
  });

  it("preserves quantity tokens", () => {
    expect(stripPromotionalPrefixes("[BOGO] ROUND LAB Cleanser 150ml")).toContain("150ml");
    expect(stripPromotionalPrefixes("[NEW] Serum 30g*5")).toContain("30g*5");
    expect(stripPromotionalPrefixes("[SALE] SPF50+ PA++++ Sun Stick")).toContain("SPF50+");
  });
});

describe("stripSellerBrandPrefix", () => {
  it("strips seller brand from the start", () => {
    expect(stripSellerBrandPrefix("COSRX Pure Fit Cica Cream 50ml", "COSRX")).toBe(
      "Pure Fit Cica Cream 50ml"
    );
    expect(stripSellerBrandPrefix("Innisfree Auto Eyebrow Pencil 0.3g", "INNISFREE")).toBe(
      "Auto Eyebrow Pencil 0.3g"
    );
  });

  it("does not strip partial brand prefixes", () => {
    expect(stripSellerBrandPrefix("COSRX Snail Essence", "COS")).toBe("COSRX Snail Essence");
  });

  it("skips synthetic aisle brands", () => {
    expect(stripSellerBrandPrefix("[BOGO] Mary&May Serum", "💗BOGO")).toBe("[BOGO] Mary&May Serum");
    expect(stripSellerBrandPrefix("[K-POP] Album", "K-POP")).toBe("[K-POP] Album");
  });
});

describe("normalizeProductTitle", () => {
  it("applies promo strip then brand strip", () => {
    expect(
      normalizeProductTitle("[BOGO] COSRX Pure Fit Cica Cream 50ml", "COSRX")
    ).toBe("Pure Fit Cica Cream 50ml");
  });

  it("normalizes for dedup comparison", () => {
    const a = normalizeProductNameForDedup(
      "[BOGO] COSRX Pure Fit Cica Cream 50ml",
      "COSRX"
    );
    const b = normalizeProductNameForDedup("COSRX Pure Fit Cica Cream 50ml", "COSRX");
    expect(a).toBe(b);
  });

  it("strips trailing pack size for dedup comparison across sizes", () => {
    const small = normalizeProductNameForDedup("Vitamin C Serum 500mg", "Brand");
    const large = normalizeProductNameForDedup("Vitamin C Serum 1000mg", "Brand");
    expect(small).toBe(large);
  });
});

describe("canonicalProductBaseName", () => {
  it("returns promo/brand/pack-stripped title for storage", () => {
    expect(
      canonicalProductBaseName("[BOGO] COSRX Pure Fit Cica Cream 50ml", "COSRX")
    ).toBe("Pure Fit Cica Cream");
  });
});
