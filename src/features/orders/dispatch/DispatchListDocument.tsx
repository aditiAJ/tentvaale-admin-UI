/**
 * An order's dispatch list as a PDF, in the quotation's header and footer: a card per item with its picture, name, a
 * big quantity and its details, grouped by the warehouse it is picked from and then by the place inside it. What no
 * warehouse holds is gathered under "No warehouse assigned to this product".
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
  /** Said on the card in place of a location (the no-warehouse and one-time cases). */
  note: string | null;
}

export interface DispatchGroup {
  kind: "warehouse" | "unassigned" | "other";
  title: string;
  subtitle: string | null;
  entries: DispatchEntry[];
}

export interface DispatchDoc {
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
const WARN_SOFT = "#fdecea";
const countUnits = (entries: DispatchEntry[]) => entries.reduce((sum, e) => sum + e.quantity, 0);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

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

const PER_ROW = 3;
const CARD_HEIGHT = 112;

function styles(c: ReturnType<typeof make>["c"]) {
  return StyleSheet.create({
    // One block per warehouse: a heavy bar with its number, name and totals, so the eye finds where one ends and the next begins.
    groupHead: { flexDirection: "row", alignItems: "center", backgroundColor: HEAD, borderBottomWidth: 2, borderBottomColor: HEAD_GOLD },
    groupNo: { width: 38, alignSelf: "stretch", backgroundColor: HEAD_GOLD, alignItems: "center", justifyContent: "center" },
    groupNoText: { color: HEAD, fontFamily: "Playfair Display", fontWeight: 700, fontSize: 18 },
    groupBody: { flex: 1, paddingVertical: 9, paddingHorizontal: 12 },
    groupTitle: { color: HEAD_GOLD, fontFamily: "Playfair Display", fontWeight: 700, fontSize: 15, letterSpacing: 0.6 },
    groupSub: { color: "#f4ead2", fontSize: 8, marginTop: 2 },
    groupStats: { flexDirection: "row", gap: 16, paddingRight: 14 },
    stat: { alignItems: "flex-end" },
    statValue: { color: HEAD_GOLD, fontWeight: 700, fontSize: 15 },
    statLabel: { color: "#f4ead2", fontSize: 6.5, letterSpacing: 0.8, marginTop: 1 },
    warnHead: { backgroundColor: WARN_SOFT, borderBottomColor: "#e0a8a1" },
    // Inside a warehouse: one band per location, then its cards.
    placeHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.soft, borderLeftWidth: 3, borderLeftColor: c.gold, paddingVertical: 5, paddingHorizontal: 10, marginTop: 8 },
    placeText: { color: c.gold, fontWeight: 700, fontSize: 9.5 },
    placeCount: { color: c.muted, fontSize: 8 },
    row: { flexDirection: "row", gap: 8, marginBottom: 8 },
    card: { flex: 1, height: CARD_HEIGHT, flexDirection: "row", borderWidth: 1, borderColor: c.border, backgroundColor: c.card, borderRadius: 4, overflow: "hidden" },
    cardEmpty: { flex: 1 },
    photo: { width: 70, height: CARD_HEIGHT, backgroundColor: "#ffffff", borderRightWidth: 1, borderRightColor: c.border, alignItems: "center", justifyContent: "center" },
    photoImg: { width: 69, height: CARD_HEIGHT, objectFit: "contain" },
    info: { flex: 1, paddingVertical: 5, paddingHorizontal: 8, overflow: "hidden" },
    top: { height: 26, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 6 },
    name: { flex: 1, fontWeight: 700, fontSize: 9 },
    qtyBox: { alignItems: "flex-end" },
    qty: { color: c.gold, fontWeight: 700, fontSize: 18, lineHeight: 1 },
    qtyLabel: { color: c.muted, fontSize: 6, letterSpacing: 0.8, marginTop: 2 },
    // Every card has the same slots in the same order, so the same thing sits at the same height on each.
    slotVariant: { height: 20, paddingTop: 4 },
    slotOccasion: { height: 12, paddingTop: 2 },
    slotRemark: { height: 24, paddingTop: 3 },
    slotNote: { height: 17, paddingTop: 3 },
    chip: { alignSelf: "flex-start", backgroundColor: c.soft, color: c.text, fontSize: 7.5, fontWeight: 600, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    detail: { color: c.muted, fontSize: 7 },
    remark: { color: c.text, fontSize: 7, paddingLeft: 6, borderLeftWidth: 2, borderLeftColor: c.gold },
    noPlace: { alignSelf: "flex-start", backgroundColor: WARN_SOFT, color: WARN, fontSize: 7, fontWeight: 600, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
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
  const subtitle = doc.quotationNumber ? `Order ${doc.orderNumber} · from ${doc.quotationNumber}` : `Order ${doc.orderNumber}`;
  const totalUnits = doc.groups.reduce((sum, g) => sum + countUnits(g.entries), 0);
  const many = doc.groups.length > 1;

  const card = (e: DispatchEntry, i: number) => {
    const picture = e.image ? (doc.images[e.image] ?? null) : null;
    return (
      <View style={x.card} key={`${e.name}-${i}`}>
        <View style={x.photo}>
          {picture ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt text
            <Image src={picture} style={x.photoImg} />
          ) : (
            <Text style={[s.muted, { fontSize: 7 }]}>No picture</Text>
          )}
        </View>
        <View style={x.info}>
          <View style={x.top}>
            <Text style={x.name}>{e.name}</Text>
            <View style={x.qtyBox}>
              <Text style={x.qty}>{e.quantity}</Text>
              <Text style={x.qtyLabel}>{e.quantity === 1 ? "UNIT" : "UNITS"}</Text>
            </View>
          </View>
          <View style={x.slotVariant}>{e.variant ? <Text style={x.chip}>{e.variant}</Text> : null}</View>
          <View style={x.slotOccasion}>{e.occasion ? <Text style={x.detail}>{e.occasion}</Text> : null}</View>
          <View style={x.slotRemark}>{e.remark ? <Text style={x.remark}>{e.remark}</Text> : null}</View>
          <View style={x.slotNote}>{e.location === null ? <Text style={x.noPlace}>{e.note ?? "Location not set"}</Text> : null}</View>
        </View>
      </View>
    );
  };

  return (
    <Document title={`Dispatch list ${doc.orderNumber}`} author={co.name} subject={`Dispatch list for ${doc.customerName}`}>
      <Page size="A4" style={s.page}>
        <Header s={s} doc={doc} big title="DISPATCH LIST" subtitle={subtitle} meta={meta} />
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
            const tone = problem ? { color: WARN } : {};
            return (
              // Each warehouse starts on a page of its own when there are several, so a team can be handed just its pages.
              <View key={`${g.kind}-${g.title}-${gi}`} break={many && gi > 0} style={{ marginTop: gi === 0 ? 10 : 16 }}>
                <View style={[x.groupHead, problem ? x.warnHead : {}]} minPresenceAhead={90}>
                  {many ? (
                    <View style={[x.groupNo, problem ? { backgroundColor: "#e0a8a1" } : {}]}>
                      <Text style={[x.groupNoText, problem ? { color: WARN } : {}]}>{gi + 1}</Text>
                    </View>
                  ) : null}
                  <View style={x.groupBody}>
                    <Text style={[x.groupTitle, tone]}>{g.title.toUpperCase()}</Text>
                    {g.subtitle ? <Text style={[x.groupSub, tone]}>{g.subtitle}</Text> : null}
                  </View>
                  <View style={x.groupStats}>
                    <View style={x.stat}>
                      <Text style={[x.statValue, tone]}>{g.entries.length}</Text>
                      <Text style={[x.statLabel, tone]}>{g.entries.length === 1 ? "ITEM" : "ITEMS"}</Text>
                    </View>
                    <View style={x.stat}>
                      <Text style={[x.statValue, tone]}>{countUnits(g.entries)}</Text>
                      <Text style={[x.statLabel, tone]}>UNITS</Text>
                    </View>
                  </View>
                </View>

                {byPlace(g.entries).map((p) => (
                  <View key={p.place || "none"} style={p.placed ? {} : { marginTop: 8 }}>
                    {p.placed ? (
                      <View style={x.placeHead} minPresenceAhead={60}>
                        <Text style={x.placeText}>{p.place}</Text>
                        <Text style={x.placeCount}>
                          {plural(p.entries.length, "item")} · {plural(countUnits(p.entries), "unit")}
                        </Text>
                      </View>
                    ) : null}
                    {/* Rows of cards, each kept whole: a wrapping grid that has to split across pages can stall the PDF layout. */}
                    <View style={{ marginTop: 7 }}>
                      {Array.from({ length: Math.ceil(p.entries.length / PER_ROW) }, (_, r) => {
                        const cards = p.entries.slice(r * PER_ROW, r * PER_ROW + PER_ROW);
                        return (
                          <View key={r} wrap={false} style={x.row}>
                            {cards.map((e, i) => card(e, r * PER_ROW + i))}
                            {cards.length < PER_ROW ? <View style={x.cardEmpty} /> : null}
                          </View>
                        );
                      })}
                    </View>
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
