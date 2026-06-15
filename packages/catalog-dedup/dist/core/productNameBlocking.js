import { normalizeProductNameForDedup } from "./productNameNormalize.js";
function namesForBlocking(nameA, nameB, options) {
    const brandA = options?.brandA ?? "";
    const brandB = options?.brandB ?? "";
    return {
        a: normalizeProductNameForDedup(nameA, brandA),
        b: normalizeProductNameForDedup(nameB, brandB),
    };
}
/** Alphanumeric tokens of length >= 3 for loose name blocking (same brand). */
export function significantTokens(name) {
    const raw = name.toLowerCase().match(/[a-z0-9\uac00-\ud7af]{3,}/g) ?? [];
    const stop = new Set([
        "the",
        "and",
        "for",
        "new",
        "set",
        "ml",
        "g",
        "ea",
        "pcs",
        "spf",
        "ver",
    ]);
    return new Set(raw.filter((t) => !stop.has(t)));
}
export function tokenOverlapCount(a, b) {
    const ta = significantTokens(a);
    const tb = significantTokens(b);
    let n = 0;
    for (const t of ta) {
        if (tb.has(t))
            n++;
    }
    return n;
}
export function isBlockedPair(nameA, nameB, minOverlap, options) {
    const { a, b } = namesForBlocking(nameA, nameB, options);
    if (a === b)
        return true;
    if (tokenOverlapCount(a, b) >= minOverlap)
        return true;
    if (a.length >= 12 && b.length >= 12 && (a.includes(b.slice(0, 12)) || b.includes(a.slice(0, 12)))) {
        return true;
    }
    return false;
}
//# sourceMappingURL=productNameBlocking.js.map