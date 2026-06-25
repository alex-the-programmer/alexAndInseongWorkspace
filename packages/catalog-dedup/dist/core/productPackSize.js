import { collapseWhitespace } from "./productNameNormalize.js";
export const PackUnit = {
    MG: "MG",
    G: "G",
    ML: "ML",
    FL_OZ: "FL_OZ",
    OZ: "OZ",
    CAPSULE: "CAPSULE",
    TABLET: "TABLET",
    COUNT: "COUNT",
    PIECE: "PIECE",
    STICK: "STICK",
    PAIR: "PAIR",
    UNKNOWN: "UNKNOWN",
};
const UNKNOWN_PACK = {
    packAmount: 0,
    packUnit: PackUnit.UNKNOWN,
    packCount: 1,
    matchedSuffix: null,
};
const WEIGHT_VOLUME_UNITS = {
    mg: PackUnit.MG,
    g: PackUnit.G,
    ml: PackUnit.ML,
    oz: PackUnit.OZ,
    "fl oz": PackUnit.FL_OZ,
};
const COUNT_UNITS = {
    capsule: PackUnit.CAPSULE,
    capsules: PackUnit.CAPSULE,
    cap: PackUnit.CAPSULE,
    caps: PackUnit.CAPSULE,
    tablet: PackUnit.TABLET,
    tablets: PackUnit.TABLET,
    pill: PackUnit.CAPSULE,
    pills: PackUnit.CAPSULE,
    pc: PackUnit.PIECE,
    pcs: PackUnit.PIECE,
    ea: PackUnit.PIECE,
    count: PackUnit.COUNT,
    sheet: PackUnit.COUNT,
    sheets: PackUnit.COUNT,
    stick: PackUnit.STICK,
    sticks: PackUnit.STICK,
    pair: PackUnit.PAIR,
    pairs: PackUnit.PAIR,
};
function normalizeUnitToken(raw) {
    return raw.replace(/\./g, "").replace(/\s+/g, " ").trim().toLowerCase();
}
function resolveWeightVolumeUnit(raw) {
    const key = normalizeUnitToken(raw);
    if (key === "ml")
        return PackUnit.ML;
    return WEIGHT_VOLUME_UNITS[key] ?? null;
}
function isSpfContext(before, matched) {
    const window = `${before}${matched}`.toLowerCase();
    return /\bspf\s*\d/i.test(window) || /\bpa\+/i.test(window);
}
function isShadeContext(before) {
    return /(?:#|no\.?\s*)\d*\s*$/i.test(before.trim());
}
function tryParseCompoundWeightVolume(title) {
    const match = title.match(/^(.*?)(?:\s*[-|(,]\s*)?(\d+(?:\.\d+)?)\s*(mg|g|ml|mL|oz|fl\.?\s*oz)\s*[*x×]\s*(\d+)\s*$/i);
    if (!match)
        return null;
    const before = match[1];
    const matchedSuffix = match[0].slice(before.length);
    if (isSpfContext(before, matchedSuffix) || isShadeContext(before))
        return null;
    const packUnit = resolveWeightVolumeUnit(match[3]);
    if (!packUnit)
        return null;
    return {
        baseName: before.trim(),
        packAmount: Number(match[2]),
        packUnit,
        packCount: Number(match[4]),
        matchedSuffix,
    };
}
function tryParseSimpleWeightVolume(title) {
    const match = title.match(/^(.*?)(?:\s*[-|(,]\s*)?(\d+(?:\.\d+)?)\s*(mg|g|ml|mL|oz|fl\.?\s*oz)\s*$/i);
    if (!match)
        return null;
    const before = match[1];
    const matchedSuffix = match[0].slice(before.length);
    if (isSpfContext(before, matchedSuffix) || isShadeContext(before))
        return null;
    const packUnit = resolveWeightVolumeUnit(match[3]);
    if (!packUnit)
        return null;
    return {
        baseName: before.trim(),
        packAmount: Number(match[2]),
        packUnit,
        packCount: 1,
        matchedSuffix,
    };
}
function tryParseCountSuffix(title) {
    const match = title.match(/^(.*?)(?:\s*[-|(,]\s*)?(\d+)\s*(capsules?|caps?|tablets?|pills?|pcs|ea|count|sheets?|sticks?|pairs?)\s*$/i);
    if (!match)
        return null;
    const before = match[1];
    const matchedSuffix = match[0].slice(before.length);
    if (isShadeContext(before))
        return null;
    const packUnit = COUNT_UNITS[match[3].toLowerCase()];
    if (!packUnit)
        return null;
    return {
        baseName: before.trim(),
        packAmount: Number(match[2]),
        packUnit,
        packCount: 1,
        matchedSuffix,
    };
}
/** Strip trailing metadata parentheticals, e.g. "(5 Options)" or "(3 Colors)". */
function stripTrailingParentheticals(title) {
    let result = title.trim();
    for (;;) {
        const stripped = result.replace(/\s+\([^)]+\)\s*$/u, "").trim();
        if (stripped === result)
            break;
        result = stripped;
    }
    return result;
}
/** Parse trailing pack size from a product title. */
export function parsePackSizeFromTitle(title) {
    const normalized = collapseWhitespace(title);
    if (!normalized) {
        return { baseName: "", ...UNKNOWN_PACK };
    }
    const forPackParse = stripTrailingParentheticals(normalized);
    const parsed = tryParseCompoundWeightVolume(forPackParse) ??
        tryParseSimpleWeightVolume(forPackParse) ??
        tryParseCountSuffix(forPackParse);
    if (!parsed) {
        return { baseName: normalized, ...UNKNOWN_PACK };
    }
    return {
        baseName: collapseWhitespace(parsed.baseName),
        packAmount: parsed.packAmount,
        packUnit: parsed.packUnit,
        packCount: parsed.packCount,
        matchedSuffix: collapseWhitespace(parsed.matchedSuffix),
    };
}
/** Title with trailing pack size removed (for product-line dedup grouping). */
export function stripPackSizeForDedup(title) {
    return parsePackSizeFromTitle(title).baseName;
}
export function formatPackSizeLabel(pack) {
    if (pack.packUnit === PackUnit.UNKNOWN || pack.packAmount <= 0)
        return "";
    const unitLabel = pack.packUnit.toLowerCase().replace(/_/g, " ");
    if (pack.packCount > 1) {
        return `${pack.packAmount} ${unitLabel} × ${pack.packCount}`;
    }
    return `${pack.packAmount} ${unitLabel}`;
}
//# sourceMappingURL=productPackSize.js.map