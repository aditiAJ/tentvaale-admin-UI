"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCan } from "@/features/auth";
import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import {
  COLOUR_SUGGESTIONS,
  FABRIC_SUGGESTIONS,
  MATERIAL_SUGGESTIONS,
  MOODS,
  PRODUCT_SETTINGS,
  THEMES,
} from "@/features/master-data/storefront";

/**
 * The lists the product form picks from (mood, theme fit, indoor / outdoor, colours, materials, fabrics). They are
 * shared facets in the backend, managed in Settings → General settings; the values in storefront.ts are only what a
 * new list starts with. A list the backend does not have yet is created from them the first time a person who may
 * write opens the product form or the settings page, so the first product saved cannot leave a list with one value.
 */
export interface CatalogueList {
  code: string;
  /** What the settings page and the product form call it. */
  label: string;
  /** The facet's own name in the backend. */
  facetLabel: string;
  multiValued: boolean;
  hint: string;
  defaults: readonly string[];
}

export const CATALOGUE_LISTS: readonly CatalogueList[] = [
  { code: "mood", label: "Mood", facetLabel: "Mood", multiValued: true, defaults: MOODS, hint: "Chosen on the product form; the storefront filters by it." },
  { code: "theme", label: "Theme fit", facetLabel: "Theme", multiValued: true, defaults: THEMES, hint: "Chosen on the product form; the storefront filters by it." },
  { code: "setting", label: "Indoor / outdoor", facetLabel: "Indoor / outdoor", multiValued: false, defaults: PRODUCT_SETTINGS, hint: "One value per product." },
  { code: "colour", label: "Colours", facetLabel: "Colour", multiValued: true, defaults: COLOUR_SUGGESTIONS, hint: "Suggested while typing; a new colour typed on a product is added here." },
  { code: "material", label: "Materials", facetLabel: "Material", multiValued: true, defaults: MATERIAL_SUGGESTIONS, hint: "Suggested while typing; a new material typed on a product is added here." },
  { code: "fabric", label: "Upholstery fabrics", facetLabel: "Fabric", multiValued: true, defaults: FABRIC_SUGGESTIONS, hint: "Suggested while typing; a new fabric typed on a product is added here." },
];

export interface ListValue {
  id: number;
  value: string;
  displayOrder: number;
  active: boolean;
}

export interface ListFacet {
  id: number;
  code: string;
  label: string;
  scope: string;
  active: boolean;
  values: ListValue[];
}

const BASE = "/admin/master-data";
export const catalogueListKeys = { all: ["master-data", "catalogue-lists"] as const };

export const fetchLists = (signal?: AbortSignal) => apiFetch<ListFacet[]>(`${BASE}/facets`, { signal });

export const createList = (list: CatalogueList, values: readonly string[]) =>
  apiFetch<ListFacet>(`${BASE}/facets`, {
    method: "POST",
    body: { code: list.code, label: list.facetLabel, multiValued: list.multiValued, displayOrder: 0, values },
  });

export const addListValue = (facetId: number, value: string, displayOrder: number) =>
  apiFetch<ListValue>(`${BASE}/facets/${facetId}/values`, { method: "POST", body: { value, displayOrder } });

export const updateListValue = (valueId: number, value: ListValue, change: { value?: string; active?: boolean }) =>
  apiFetch<ListValue>(`${BASE}/facet-values/${valueId}`, {
    method: "PUT",
    body: { value: change.value ?? value.value, displayOrder: value.displayOrder, active: change.active ?? value.active },
  });

/** The company's global facet for a list, if the backend has one. */
export const facetOf = (facets: ListFacet[] | undefined, code: string) =>
  facets?.find((f) => f.code.toLowerCase() === code && f.scope === "GLOBAL");

/** Values in the order they are shown. */
export const sortedValues = (facet: ListFacet) =>
  [...facet.values].sort((a, b) => a.displayOrder - b.displayOrder || a.value.localeCompare(b.value));

let seeding: Promise<void> | null = null;

/**
 * The lists as the product form should offer them: the active values of each, or the built-in starting values while
 * the backend has no such list (demo data, no permission to create it, or the first moment of loading). Also
 * creates the missing lists, once, for a person who may write.
 */
export function useCatalogueLists() {
  const queryClient = useQueryClient();
  const canWrite = useCan("MASTER_DATA_WRITE");
  const query = useQuery({
    queryKey: catalogueListKeys.all,
    queryFn: ({ signal }) => fetchLists(signal),
    enabled: !IS_MOCK,
    staleTime: 60_000,
  });
  const facets = query.data;

  useEffect(() => {
    if (!canWrite || !facets || seeding) return;
    const missing = CATALOGUE_LISTS.filter((list) => !facetOf(facets, list.code));
    if (missing.length === 0) return;
    // One at a time and only once: two screens asking together must not both create the same list.
    seeding = Promise.all(missing.map((list) => createList(list, list.defaults).catch(() => undefined)))
      .then(() => queryClient.invalidateQueries({ queryKey: catalogueListKeys.all }))
      .then(() => undefined)
      .finally(() => {
        seeding = null;
      });
  }, [canWrite, facets, queryClient]);

  const options = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const list of CATALOGUE_LISTS) {
      const facet = facetOf(facets, list.code);
      result[list.code] = facet ? sortedValues(facet).filter((v) => v.active).map((v) => v.value) : [...list.defaults];
    }
    return result;
  }, [facets]);

  return { facets, options, isPending: query.isPending && !IS_MOCK, isError: query.isError };
}

/** What a product already has is kept in its list even if the list no longer offers it, so editing never drops it unseen. */
export const withCurrent = (options: readonly string[], current: readonly string[]) => [
  ...options,
  ...current.filter((value) => !options.includes(value)),
];
