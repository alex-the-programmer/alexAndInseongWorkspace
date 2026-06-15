export function isUniqueConstraintError(e) {
    return (typeof e === "object" &&
        e !== null &&
        "code" in e &&
        e.code === "P2002");
}
//# sourceMappingURL=isUniqueConstraintError.js.map