/**
 * An order's dispatch list as a PDF, in the quotation's header and footer. Two editions of the same list: "pictures"
 * (a tile per item with its picture, for the person picking by sight) and "list" (a table, for the
 * person with a clipboard). Items are grouped by the warehouse they are picked from, with the location inside it;
 * what no warehouse holds is gathered under "No warehouse assigned to this product".
 */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  Footer,
  HEAD,
  HEAD_GOLD,
  Header,
  longDate,
  make,
  type DocCompany,
  type DocTheme,
  type IconName,
} from "@/features/quotations/components/QuotationDocument";

export interface DispatchEntry {
  name: string;
  variant: string | null;
  remark: string | null;
  /** "Haldi · 25 Oct 2026"; null when the quotation has no functions. */
  occasion: string | null;
  quantity: number;
  /** A key of `DispatchDoc.images`; null when there is no picture. */
  image: string | null;
  /** Where in the warehouse ("Front hall > Bay 02"); null when the units are not placed anywhere. */
  location: string | null;
  /** Said under the item in place of a location (the no-warehouse and one-time cases). */
  note: string | null;
}

export interface DispatchGroup {
  kind: "warehouse" | "unassigned" | "other";
  title: string;
  subtitle: string | null;
  entries: DispatchEntry[];
}

export interface DispatchDoc {
  edition: "pictures" | "list";
  orderNumber: string;
  quotationNumber: string | null;
  /** yyyy-MM-dd */
  preparedOn: string;
  eventDate: string | null;
  venue: string | null;
  customerName: string;
  status: string;
  groups: DispatchGroup[];
  company: DocCompany;
  images: Record<string, string>;
  picturesMissing: number;
}

const WARN = "#9b2c20";
const countUnits = (entries: DispatchEntry[]) => entries.reduce((sum, e) => sum + e.quantity, 0);

/** The entries of a warehouse split by where in it they sit, in the order they come (they arrive sorted by place). */
function byPlace(entries: DispatchEntry[]): { place: string; placed: boolean; entries: DispatchEntry[] }[] {
  const out: { place: string; placed: boolean; entries: DispatchEntry[] }[] = [];
  for (const e of entries) {
    // Items with no place share one run without a band; each says so itself.
    const place = e.location ?? "";
    const last = out[out.length - 1];
    if (last && last.place === place) last.entries.push(e);
    else out.push({ place, placed: e.location !== null, entries: [e] });
  }
  return out;
}

function styles(c: ReturnType<typeof make>["c"]) {
  return StyleSheet.create({
    // One block per warehouse: a heavy bar with its name, code and totals, so the eye finds where one ends and the next begins.
    groupHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: HEAD, paddingVertical: 7, paddingHorizontal: 11, borderBottomWidth: 2, borderBottomColor: HEAD_GOLD },
    groupTitle: { color: HEAD_GOLD, fontFamily: "Playfair Display", fontWeight: 700, fontSize: 12.5, letterSpacing: 0.8 },
    groupCode: { color: "#f4ead2", fontSize: 8, marginTop: 2 },
    groupTotals: { color: HEAD_GOLD, fontWeight: 700, fontSize: 9, textAlign: "right" },
    warnHead: { backgroundColor: "#fdecea", borderBottomColor: "#e0a8a1" },
    // Inside a warehouse: one band per location, then its items.
    placeHead: { flexDirection: "row", justifyContent: "space-between", backgroundColor: c.soft, borderLeftWidth: 3, borderLeftColor: c.gold, paddingVertical: 4, paddingHorizontal: 9, marginTop: 8 },
    placeText: { color: c.gold, fontWeight: 700, fontSize: 9 },
    placeCount: { color: c.muted, fontSize: 8 },
    summaryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: c.border },
        tile: { width: 126, height: 142, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, borderRadius: 3, overflow: "hidden" },
        tileImg: { width: "100%", height: 92, objectFit: "cover" },
        tileNoImg: { height: 92, backgroundColor: c.soft, alignItems: "center", justifyContent: "center" },
    tileText: { height: 40, paddingHorizontal: 6, paddingTop: 4, overflow: "hidden" },
    noPlace: { backgroundColor: "#fdecea", color: WARN, fontSize: 6.5, fontWeight: 600, paddingHorizontal: 6, paddingVertical: 2 },
    qty: { position: "absolute", top: 5, right: 5, backgroundColor: HEAD, color: HEAD_GOLD, fontSize: 9, fontWeight: 700, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  });
}

export function DispatchListDocument({ doc, theme }: { doc: DispatchDoc; theme: DocTheme }) {
  const { s, c } = make(theme);
  const x = styles(c);
  const co = doc.company;
  const meta = [
    { icon: "doc" as IconName, label: "ORDER NO.", value: doc.orderNumber },
    { icon: "calendar" as IconName, label: "EVENT DATE", value: longDate(doc.eventDate) ?? "To be confirmed" },
    { icon: "pin" as IconName, label: "VENUE", value: doc.venue ?? "To be confirmed" },
    { icon: "user" as IconName, label: "CUSTOMER", value: doc.customerName },
  ];
  const title = doc.edition === "pictures" ? "DISPATCH LIST · PICTURES" : "DISPATCH LIST";
  const subtitle = doc.quotationNumber ? `Order ${doc.orderNumber} · from ${doc.quotationNumber}` : `Order ${doc.orderNumber}`;
  const totalUnits = doc.groups.reduce((sum, g) => sum + countUnits(g.entries), 0);
  const many = doc.groups.length > 1;

  const row = (e: DispatchEntry, i: number) => (
    <View style={s.tr} key={`${e.name}-${i}`} wrap={false}>
      <Text style={[s.cellCenter, s.gold, { width: 24, fontSize: 8 }]}>{i + 1}</Text>
      <View style={{ flex: 1, paddingHorizontal: 6 }}>
        <Text style={{ fontWeight: 600 }}>{e.name}</Text>
        {e.variant ? <Text style={[s.muted, { fontSize: 7.5, marginTop: 1 }]}>{e.variant}</Text> : null}
        {e.occasion ? <Text style={[s.muted, { fontSize: 7.5, marginTop: 1 }]}>{e.occasion}</Text> : null}
        {e.remark ? <Text style={[s.muted, { fontSize: 7.5, marginTop: 1 }]}>{e.remark}</Text> : null}
        {e.location === null ? <Text style={{ color: WARN, fontSize: 7.5, fontWeight: 600, marginTop: 1 }}>{e.note ?? "Location not set"}</Text> : null}
      </View>
      <Text style={[s.cellCenter, { width: 60, fontWeight: 700, fontSize: 10 }]}>{e.quantity}</Text>
    </View>
  );

  const tile = (e: DispatchEntry, i: number) => {
    const picture = e.image ? (doc.images[e.image] ?? null) : null;
    return (
      <View style={x.tile} key={`${e.name}-${i}`} wrap={false}>
        <View>
          {picture ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt text
            <Image src={picture} style={x.tileImg} />
          ) : (
            <View style={x.tileNoImg}>
              <Text style={[s.muted, { fontSize: 7 }]}>No picture</Text>
            </View>
          )}
          <Text style={x.qty}>× {e.quantity}</Text>
        </View>
        {e.location === null ? <Text style={x.noPlace}>{e.note ?? "Location not set"}</Text> : null}
        <View style={x.tileText}>
          <Text style={{ fontWeight: 600, fontSize: 8 }}>{e.name}</Text>
          {e.variant ? <Text style={[s.muted, { fontSize: 7, marginTop: 1 }]}>{e.variant}</Text> : null}
          {e.remark ? <Text style={[s.muted, { fontSize: 6.5, marginTop: 1 }]}>{e.remark}</Text> : null}
        </View>
      </View>
    );
  };

  return (
    <Document title={`Dispatch list ${doc.orderNumber}`} author={co.name} subject={`Dispatch list for ${doc.customerName}`}>
      <Page size="A4" style={s.page}>
        <Header s={s} doc={doc} big title={title} subtitle={subtitle} meta={meta} />
        <View style={s.body}>
          <View style={[s.strip, { paddingVertical: 8 }]} wrap={false}>
            <Text style={{ fontSize: 8.5 }}>
              <Text style={{ color: c.gold, fontWeight: 700 }}>{totalUnits}</Text> units to dispatch · prepared {longDate(doc.preparedOn)} · order is{" "}
              {doc.status.toLowerCase()}
            </Text>
          </View>

          {doc.groups.length === 0 ? <Text style={[s.muted, { marginTop: 16 }]}>This order has no items to dispatch.</Text> : null}

          {doc.groups.map((g, gi) => {
            const problem = g.kind === "unassigned";
            return (
              // Each warehouse starts on a page of its own when there are several, so a team can be handed just its pages.
              <View key={`${g.kind}-${g.title}-${gi}`} break={many && gi > 0} style={{ marginTop: 16 }}>
                <View style={[x.groupHead, problem ? x.warnHead : {}]} minPresenceAhead={90}>
                  <View>
                    <Text style={[x.groupTitle, problem ? { color: WARN } : {}]}>{many ? `${gi + 1}. ` : ""}{g.title.toUpperCase()}</Text>
                    {g.subtitle ? <Text style={[x.groupCode, problem ? { color: WARN } : {}]}>{g.subtitle}</Text> : null}
                  </View>
                  <Text style={[x.groupTotals, problem ? { color: WARN } : {}]}>
                    {g.entries.length} item{g.entries.length === 1 ? "" : "s"} · {countUnits(g.entries)} units
                  </Text>
                </View>

                {byPlace(g.entries).map((p) => (
                  <View key={p.place || "none"} style={p.placed ? {} : { marginTop: 8 }}>
                    {p.placed ? (
                      <View style={x.placeHead} minPresenceAhead={60}>
                        <Text style={x.placeText}>{p.place}</Text>
                        <Text style={x.placeCount}>{countUnits(p.entries)} units</Text>
                      </View>
                    ) : null}
                    {doc.edition === "list" ? (
                      <View style={s.table}>
                        <View style={s.thead} fixed>
                          <Text style={[s.th, { width: 24 }]}>#</Text>
                          <Text style={[s.th, { flex: 1, textAlign: "left" }]}>ITEM</Text>
                          <Text style={[s.th, { width: 60 }]}>QTY</Text>
                        </View>
                        {p.entries.map(row)}
                      </View>
                    ) : (
                      // Rows of four, each kept whole: a wrapping grid that has to split across pages can stall the PDF layout.
                      <View style={{ marginTop: 7 }}>
                        {Array.from({ length: Math.ceil(p.entries.length / 4) }, (_, r) => (
                          <View key={r} wrap={false} style={{ flexDirection: "row", gap: 9, marginBottom: 9 }}>
                            {p.entries.slice(r * 4, r * 4 + 4).map((e, i) => tile(e, r * 4 + i))}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            );
          })}
        </View>
        <Footer s={s} company={co} />
      </Page>
    </Document>
  );
}
