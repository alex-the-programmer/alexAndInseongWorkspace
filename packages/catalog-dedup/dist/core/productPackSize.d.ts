export declare const PackUnit: {
    readonly MG: "MG";
    readonly G: "G";
    readonly ML: "ML";
    readonly FL_OZ: "FL_OZ";
    readonly OZ: "OZ";
    readonly CAPSULE: "CAPSULE";
    readonly TABLET: "TABLET";
    readonly COUNT: "COUNT";
    readonly PIECE: "PIECE";
    readonly STICK: "STICK";
    readonly PAIR: "PAIR";
    readonly UNKNOWN: "UNKNOWN";
};
export type PackUnit = (typeof PackUnit)[keyof typeof PackUnit];
export type PackSizeParseResult = {
    baseName: string;
    packAmount: number;
    packUnit: PackUnit;
    packCount: number;
    matchedSuffix: string | null;
};
/** Parse trailing pack size from a product title. */
export declare function parsePackSizeFromTitle(title: string): PackSizeParseResult;
/** Title with trailing pack size removed (for product-line dedup grouping). */
export declare function stripPackSizeForDedup(title: string): string;
export declare function formatPackSizeLabel(pack: Pick<PackSizeParseResult, "packAmount" | "packUnit" | "packCount">): string;
//# sourceMappingURL=productPackSize.d.ts.map