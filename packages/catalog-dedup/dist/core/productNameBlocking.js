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
export function isBlockedPair(skName, oyName, minOverlap) {
    if (tokenOverlapCount(skName, oyName) >= minOverlap)
        return true;
    const s = skName.toLowerCase().replace(/\s+/g, " ").trim();
    const o = oyName.toLowerCase().replace(/\s+/g, " ").trim();
    if (s.length >= 12 && o.length >= 12 && (s.includes(o.slice(0, 12)) || o.includes(s.slice(0, 12)))) {
        return true;
    }
    return false;
}
//# sourceMappingURL=productNameBlocking.js.map