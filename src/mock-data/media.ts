import type { MediaAsset } from "@/features/master-data/types";

/**
 * Which seeded image each catalogue record gets.
 *
 * The one place a seeded record is matched to a file under public/mock-media:
 * seed.ts passes its records through the `with…Media` helpers below rather than
 * naming an image per record, and the store serves the result like any other
 * field. A real backend would populate the same `media` arrays itself, so
 * nothing downstream knows these came from here.
 *
 * Matching is by what a record is, not by its id: a product by its name and
 * generic name, a category by its name, a bundle or collection by the theme
 * in its name. The first rule that matches wins. A record nothing matches gets
 * no media and renders the fallback image, which is also what every product
 * shows in api mode — the cocktail table and the uplight are left unmatched
 * because no honest image was found for them.
 *
 * Only catalogue records carry media. Customers, quotations, orders, deposits,
 * credit notes and notifications do not; lines show their product's image.
 */

/** Bytes per file, so the product form can show a seeded image's size like an uploaded one's. */
const ASSETS = {
  "products/frame-tent": 78424,
  "products/pole-tent": 16730,
  "products/canopy": 100290,
  "products/chiavari-chair": 5810,
  "products/folding-chair": 38766,
  "products/velvet-sofa": 45358,
  "products/round-table": 51784,
  "products/stage-deck": 73670,
  "products/fairy-light-curtain": 81430,
  "products/generator": 61036,
  "categories/tents": 47596,
  "categories/seating": 7516,
  "categories/tables": 52346,
  "categories/lighting": 41240,
  "categories/furniture": 20886,
  "categories/carpets-and-rugs": 91636,
  "bundles/wedding-mandap": 101740,
  "bundles/corporate-conference": 81738,
  "bundles/garden-party": 206836,
  "collections/royal-wedding": 216020,
  "collections/luxury-garden": 206148,
  "collections/sangeet-night": 63084,
  "collections/corporate-gala": 88970,
} as const;

type AssetKey = keyof typeof ASSETS;
type Rule = [pattern: RegExp, asset: AssetKey];

const PRODUCT_RULES: Rule[] = [
  [/frame tent/i, "products/frame-tent"],
  [/pole tent/i, "products/pole-tent"],
  [/canopy/i, "products/canopy"],
  [/chiavari/i, "products/chiavari-chair"],
  [/folding chair/i, "products/folding-chair"],
  [/sofa/i, "products/velvet-sofa"],
  [/round table/i, "products/round-table"],
  [/stage/i, "products/stage-deck"],
  [/light curtain|fairy light/i, "products/fairy-light-curtain"],
  [/generator/i, "products/generator"],
];

/**
 * Top-level categories only. Power has no image of its own and reuses the
 * generator's, since that is all it holds.
 */
const CATEGORY_RULES: Rule[] = [
  [/^tents?$/i, "categories/tents"],
  [/^seating$/i, "categories/seating"],
  [/^tables?$/i, "categories/tables"],
  [/^lighting$/i, "categories/lighting"],
  [/^power$/i, "products/generator"],
  [/^furniture$/i, "categories/furniture"],
  [/carpet|rug/i, "categories/carpets-and-rugs"],
];

const BUNDLE_RULES: Rule[] = [
  [/mandap|wedding/i, "bundles/wedding-mandap"],
  [/conference|corporate/i, "bundles/corporate-conference"],
  [/garden/i, "bundles/garden-party"],
];

const COLLECTION_RULES: Rule[] = [
  [/royal|wedding/i, "collections/royal-wedding"],
  [/garden/i, "collections/luxury-garden"],
  [/sangeet/i, "collections/sangeet-night"],
  [/corporate|gala/i, "collections/corporate-gala"],
];

/** The matched image as a one-item media list, or an empty one. */
function mediaFor(ownerId: string, text: string, rules: Rule[]): MediaAsset[] {
  const asset = rules.find(([pattern]) => pattern.test(text))?.[1];
  if (!asset) return [];
  const fileName = `${asset.split("/")[1]}.webp`;
  return [
    {
      id: `${ownerId}-media-1`,
      kind: "IMAGE",
      fileName,
      contentType: "image/webp",
      sizeBytes: ASSETS[asset],
      url: `/mock-media/${asset}.webp`,
    },
  ];
}

type Named = { id: string; name: string };

function withMedia<T extends Named>(
  records: T[],
  rules: Rule[],
  text: (record: T) => string = (record) => record.name,
): (T & { media: MediaAsset[] })[] {
  return records.map((record) => ({ ...record, media: mediaFor(record.id, text(record), rules) }));
}

export const withProductMedia = <T extends Named & { genericName: string }>(products: T[]) =>
  withMedia(products, PRODUCT_RULES, (product) => `${product.name} ${product.genericName}`);
export const withCategoryMedia = <T extends Named>(categories: T[]) =>
  withMedia(categories, CATEGORY_RULES);
export const withBundleMedia = <T extends Named>(bundles: T[]) => withMedia(bundles, BUNDLE_RULES);
export const withCollectionMedia = <T extends Named>(collections: T[]) =>
  withMedia(collections, COLLECTION_RULES);
