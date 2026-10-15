// Public surface of this module. Keep callers (the upload-product route today;
// potentially other consumers later) importing from here rather than reaching
// into validate.ts/variants.ts directly — that's what makes this extractable
// into its own service later without every call site changing.
export { validateProductImage, MIN_EDGE, MAX_EDGE, MAX_SOURCE_BYTES, type ValidationResult } from "./validate";
export { generateVariants, STANDARD_SIZES, ZOOM_SIZE, type Variant } from "./variants";
