/* eslint-disable jsx-a11y/alt-text -- react-pdf's Image is drawn into the PDF, it is not an HTML img */
/**
 * The tax invoice as a PDF, laid out after the approved reference image: a black header band with the brand, the title and
 * the invoice numbers; one split card for Bill To and Event Details; the items grouped by function in a ruled table with a total
 * for each; the summary beside the amount in words; payment details, UPI code and terms; a black footer band. Written once and
 * used unchanged by the back office and the storefront (the two copies of this file are identical): it knows nothing of either
 * app, only of the plain InvoiceDoc each one fills in.
 *
 * It prints what the invoice snapshot says and calculates nothing.
 */
import { Circle, Document, Font, Image, Line, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";

Font.register({
  family: "Noto Sans",
  fonts: [
    { src: "/fonts/NotoSans-Regular.ttf" },
    { src: "/fonts/NotoSans-SemiBold.ttf", fontWeight: 600 },
    { src: "/fonts/NotoSans-Bold.ttf", fontWeight: 700 },
  ],
});
Font.register({ family: "Playfair Display", src: "/fonts/PlayfairDisplay-Bold.woff", fontWeight: 700 });
Font.registerHyphenationCallback((word) => (word.length > 24 ? (word.match(/.{1,12}/g) ?? [word]) : [word]));

export interface InvoiceLine {
  number: number;
  description: string;
  remark: string | null;
  hsn: string | null;
  quantity: number;
  unit: string;
  days: number;
  rate: number;
  amount: number;
}

export interface InvoiceGroup {
  title: string;
  /** yyyy-MM-dd */
  date: string | null;
  lines: InvoiceLine[];
  subtotal: number;
}

export interface InvoiceDoc {
  number: string;
  /** yyyy-MM-dd */
  issuedOn: string;
  paidOn: string | null;
  /** Printed as "Event Selection No." */
  quotationNumber: string | null;
  orderNumber: string;
  seller: {
    name: string;
    address: string | null;
    gstin: string | null;
    pan: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    bankName: string | null;
    bankAccount: string | null;
    bankIfsc: string | null;
    upiId: string | null;
  };
  buyer: { name: string; email: string | null; phone: string | null; state: string | null; gstin: string | null };
  /** `date` to `dateTo` when the event runs over several days (taken from the functions when the order has no date of its own). */
  event: {
    date: string | null;
    dateTo: string | null;
    venue: string | null;
    state: string | null;
    /** The 2-digit GST state code; null when unknown. */
    stateCode: string | null;
    placeOfSupply: string | null;
    /** The function names, joined; the order does not carry a name for the event itself. */
    functions: string | null;
  };
  groups: InvoiceGroup[];
  summary: {
    discounts: number;
    itemsTotal: number;
    rentalCharges: number;
    taxRate: number | null;
    halfRate: number | null;
    intraState: boolean;
    cgst: number;
    sgst: number;
    igst: number;
    transportationAndHandling: number;
    installationAndDismantling: number;
    securityDeposit: number;
    creditNotesApplied: number;
    grandTotal: number;
  };
  amountInWords: string;
  payments: { receiptNumber: string | null; purpose: string; mode: string; paidOn: string; reference: string | null; amount: number }[];
  /** Data URLs, already loaded; null when it could not be fetched. */
  logoMark: string | null;
  upiQr: string | null;
}

const C = {
  black: "#0b0b0b",
  ink: "#1c1812",
  muted: "#6e6657",
  gold: "#b8862b",
  goldLight: "#d8aa55",
  page: "#faf6ee",
  card: "#f6efe1",
  band: "#efe4cf",
  line: "#ddd0b8",
  white: "#ffffff",
};

const s = StyleSheet.create({
  page: { backgroundColor: C.page, fontFamily: "Noto Sans", fontSize: 8, color: C.ink, paddingBottom: 52 },
  header: { backgroundColor: C.black, height: 94, flexDirection: "row", alignItems: "center", paddingHorizontal: 26 },
  brand: { width: 156, alignItems: "center" },
  mark: { width: 40, height: 34, objectFit: "contain" },
  wordmark: { fontWeight: 700, fontSize: 14, letterSpacing: 3.2, color: C.goldLight, marginTop: 3 },
  brandSub: { fontSize: 5.2, letterSpacing: 1.9, color: C.white, marginTop: 3 },
  vRule: { width: 0.75, height: 60, backgroundColor: C.gold, marginHorizontal: 12 },
  titleBox: { flex: 1, alignItems: "center" },
  title: { fontFamily: "Playfair Display", fontWeight: 700, fontSize: 25, color: C.goldLight },
  tagline: { fontSize: 7.2, color: C.white, marginTop: 6 },
  meta: { width: 168 },
  metaRow: { flexDirection: "row", marginVertical: 2.2 },
  metaKey: { width: 82, fontSize: 7, color: C.white },
  metaVal: { flex: 1, fontSize: 7.5, color: C.white },
  metaNo: { flex: 1, fontSize: 9, fontWeight: 700, color: C.goldLight },
  goldBar: { height: 2.5, backgroundColor: C.gold },
  body: { paddingHorizontal: 26 },
  supplier: { marginTop: 5, fontSize: 6.6, color: C.muted, textAlign: "center" },
  cards: { flexDirection: "row", marginTop: 8, borderWidth: 0.75, borderColor: C.line, borderRadius: 4, backgroundColor: C.card },
  cardHalf: { flex: 1, flexDirection: "row", padding: 6.5 },
  cardDivider: { width: 0.75, backgroundColor: C.line, marginVertical: 8 },
  cardBody: { flex: 1, marginLeft: 8 },
  cardHead: { fontSize: 8.5, fontWeight: 700, color: C.gold, letterSpacing: 0.6, marginTop: 2, marginBottom: 4 },
  cardName: { fontSize: 9.5, fontWeight: 700, marginBottom: 2 },
  cardLine: { fontSize: 7.6, marginTop: 1.4 },
  kvRow: { flexDirection: "row", marginTop: 1.5 },
  kvKey: { width: 66, fontSize: 7.6, color: C.ink },
  kvVal: { flex: 1, fontSize: 7.6 },
  table: { marginTop: 6, borderWidth: 0.75, borderColor: C.line, borderRadius: 3, backgroundColor: C.white },
  tableHead: { flexDirection: "row", backgroundColor: C.black, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  th: { fontSize: 6.8, fontWeight: 700, letterSpacing: 0.4, color: C.white, paddingVertical: 4.5, textAlign: "center" },
  thDivide: { borderRightWidth: 0.5, borderRightColor: "#3a3a3a" },
  groupRow: { backgroundColor: C.band, paddingVertical: 2.4, paddingHorizontal: 6, borderTopWidth: 0.5, borderTopColor: C.line },
  groupTitle: { fontSize: 8, fontWeight: 600, letterSpacing: 0.3 },
  row: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: C.line },
  cell: { paddingVertical: 1.1, borderRightWidth: 0.5, borderRightColor: C.line, justifyContent: "center" },
  cellLast: { paddingVertical: 1.1, justifyContent: "center" },
  subRow: { flexDirection: "row", backgroundColor: C.band, borderTopWidth: 0.5, borderTopColor: C.line },
  cNo: { width: "6.5%", textAlign: "center", alignItems: "center" },
  cDesc: { width: "36%", paddingLeft: 12 },
  cHsn: { width: "11%", textAlign: "center", alignItems: "center" },
  cQty: { width: "8.5%", textAlign: "center", alignItems: "center" },
  cUnit: { width: "10.5%", textAlign: "center", alignItems: "center" },
  cRate: { width: "13%", textAlign: "right", paddingRight: 8, alignItems: "flex-end" },
  cAmt: { width: "14.5%", textAlign: "right", paddingRight: 10, alignItems: "flex-end" },
  small: { fontSize: 6.4, color: C.muted, marginTop: 0.8 },
  lower: { flexDirection: "row", marginTop: 6 },
  words: { flex: 1, borderWidth: 0.75, borderColor: C.line, borderRadius: 4, padding: 9, backgroundColor: C.card, marginRight: 8, flexDirection: "row" },
  wordsHead: { fontSize: 8, fontWeight: 700, color: C.gold, letterSpacing: 0.5, marginTop: 2, marginBottom: 5 },
  wordsText: { fontSize: 9, lineHeight: 1.45 },
  summary: { width: 258, borderWidth: 0.75, borderColor: C.line, borderRadius: 3, backgroundColor: C.white },
  sumRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: C.line },
  sumLabel: { flex: 1, paddingVertical: 2.6, paddingHorizontal: 8, borderRightWidth: 0.5, borderRightColor: C.line },
  sumValue: { width: 92, paddingVertical: 2.6, paddingHorizontal: 8, textAlign: "right" },
  sumStrong: { backgroundColor: C.band, fontWeight: 700 },
  grand: { flexDirection: "row", backgroundColor: C.gold, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  grandLabel: { flex: 1, paddingVertical: 5, paddingHorizontal: 8, fontSize: 10, fontWeight: 700, color: C.white, letterSpacing: 0.5, borderRightWidth: 0.5, borderRightColor: "#d9b46a" },
  grandValue: { width: 92, paddingVertical: 5, paddingHorizontal: 8, fontSize: 11, fontWeight: 700, color: C.white, textAlign: "right" },
  foot: { flexDirection: "row", marginTop: 5, borderTopWidth: 0.75, borderTopColor: C.line, paddingTop: 6 },
  payBox: { flex: 1.2, flexDirection: "row" },
  qrBox: { width: 92, alignItems: "center", borderLeftWidth: 0.75, borderRightWidth: 0.75, borderColor: C.line, paddingHorizontal: 6, marginHorizontal: 8 },
  qr: { width: 62, height: 62, marginTop: 4 },
  termsBox: { flex: 1.35, flexDirection: "row" },
  secHead: { fontSize: 8, fontWeight: 700, color: C.gold, letterSpacing: 0.5, marginTop: 2, marginBottom: 4 },
  kvKeyBold: { width: 58, fontSize: 7.2, fontWeight: 700 },
  kvValSm: { flex: 1, fontSize: 7.2 },
  bullet: { flexDirection: "row", marginTop: 2 },
  bulletDot: { width: 7, fontSize: 7.5 },
  bulletText: { flex: 1, fontSize: 7.2, lineHeight: 1.35 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, height: 46, backgroundColor: C.black, borderTopWidth: 1.5, borderTopColor: C.gold, flexDirection: "row", alignItems: "center", paddingHorizontal: 26 },
  footBrand: { width: 160, flexDirection: "row", alignItems: "center" },
  footMark: { width: 28, height: 24, objectFit: "contain", marginRight: 7 },
  footWord: { fontWeight: 700, fontSize: 9.5, letterSpacing: 2.4, color: C.goldLight },
  footSub: { fontSize: 4.8, letterSpacing: 1.4, color: C.goldLight, marginTop: 2 },
  footRule: { width: 0.75, height: 26, backgroundColor: "#4a3a1a" },
  footMid: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  footSite: { fontSize: 8, color: C.white, marginLeft: 6 },
  footTag: { width: 160, alignItems: "flex-end" },
  footTagText: { fontSize: 6.4, letterSpacing: 1.4, color: C.white, textAlign: "right", lineHeight: 1.5 },
  footPage: { fontSize: 5.8, color: C.goldLight, marginTop: 2 },
});

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const parts = (iso: string) => iso.slice(0, 10).split("-").map(Number);
const day = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = parts(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
/** "25 – 26 October 2026" when both fall in the same month, else the two dates in full. */
const dayRange = (from: string | null, to: string | null) => {
  if (!from) return "—";
  if (!to) return day(from);
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  return y1 === y2 && m1 === m2 ? `${d1} – ${d2} ${MONTHS[m1 - 1]} ${y1}` : `${day(from)} – ${day(to)}`;
};

const hostOf = (url: string) => url.replace(/^https?:\/\//, "").split(/[/?#]/)[0];

/** The terms as the reference prints them. */
const TERMS = [
  "Goods once delivered will not be taken back.",
  "Any damage or breakage will be charged to the client.",
  "Full terms & conditions are as per Event Selection and our standard policy.",
  "This is a computer generated invoice and does not require a physical signature.",
];

type IconName = "bill" | "event" | "words" | "bank" | "terms";
const GLYPH: Record<IconName, string[]> = {
  bill: ["M9 8h7l3 3v9H9z", "M16 8v3h3", "M11 15h6", "M11 18h5"],
  event: ["M8 10h12v10H8z", "M8 13h12", "M11 8v3", "M17 8v3", "M11 16h2", "M15 16h2"],
  words: ["M9 8h7l3 3v9H9z", "M16 8v3h3", "M11 14h6", "M11 17h6"],
  bank: ["M7 12l7-4 7 4z", "M9 14v5", "M12 14v5", "M16 14v5", "M19 14v5", "M7 20h14"],
  terms: ["M10 9h8v12h-8z", "M12 7h4v3h-4z", "M12 14h4", "M12 17h4"],
};
/** A gold ring with a small drawing inside, as the reference puts before each heading. */
function Icon({ name }: { name: IconName }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 28 28">
      <Circle cx={14} cy={14} r={13} stroke={C.gold} strokeWidth={0.9} fill={C.page} />
      {GLYPH[name].map((d) => (
        <Path key={d} d={d} stroke={C.gold} strokeWidth={1.1} fill="none" />
      ))}
    </Svg>
  );
}

function Globe() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9.5} stroke={C.goldLight} strokeWidth={1.3} fill="none" />
      <Path d="M2.5 12h19" stroke={C.goldLight} strokeWidth={1.1} fill="none" />
      <Path d="M12 2.5c-3 3-3 16 0 19 3-3 3-16 0-19z" stroke={C.goldLight} strokeWidth={1.1} fill="none" />
      <Path d="M4.5 7h15M4.5 17h15" stroke={C.goldLight} strokeWidth={0.9} fill="none" />
    </Svg>
  );
}

/** A thin gold rule with a small diamond in the middle, under the brand and the title. */
function Flourish({ width }: { width: number }) {
  const mid = width / 2;
  return (
    <Svg width={width} height={8} viewBox={`0 0 ${width} 8`}>
      <Line x1={0} y1={4} x2={mid - 8} y2={4} stroke={C.gold} strokeWidth={0.7} />
      <Line x1={mid + 8} y1={4} x2={width} y2={4} stroke={C.gold} strokeWidth={0.7} />
      <Rect x={mid - 2.2} y={1.8} width={4.4} height={4.4} stroke={C.gold} strokeWidth={0.8} fill="none" transform={`rotate(45 ${mid} 4)`} />
    </Svg>
  );
}

function Brand({ doc, small }: { doc: InvoiceDoc; small?: boolean }) {
  return small ? (
    <View style={s.footBrand}>
      {doc.logoMark ? <Image src={doc.logoMark} style={s.footMark} /> : null}
      <View>
        <Text style={s.footWord}>TENTVAALE</Text>
        <Text style={s.footSub}>EXPERIENCES, ELEVATED.</Text>
      </View>
    </View>
  ) : (
    <View style={s.brand}>
      {doc.logoMark ? <Image src={doc.logoMark} style={s.mark} /> : null}
      <Text style={s.wordmark}>TENTVAALE</Text>
      <Text style={s.brandSub}>EXPERIENCES, ELEVATED.</Text>
      <View style={{ marginTop: 3 }}>
        <Flourish width={120} />
      </View>
    </View>
  );
}

function TableHead() {
  return (
    <View style={s.tableHead}>
      <Text style={[s.th, s.thDivide, s.cNo]}>#</Text>
      <Text style={[s.th, s.thDivide, s.cDesc, { paddingLeft: 0 }]}>DESCRIPTION</Text>
      <Text style={[s.th, s.thDivide, s.cHsn]}>HSN / SAC</Text>
      <Text style={[s.th, s.thDivide, s.cQty]}>QTY</Text>
      <Text style={[s.th, s.thDivide, s.cUnit]}>UNIT</Text>
      <Text style={[s.th, s.thDivide, s.cRate, { textAlign: "center", paddingRight: 0 }]}>RATE (₹)</Text>
      <Text style={[s.th, s.cAmt, { textAlign: "center", paddingRight: 0 }]}>AMOUNT (₹)</Text>
    </View>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={[s.sumRow, strong ? s.sumStrong : {}]} wrap={false}>
      <Text style={s.sumLabel}>{label}</Text>
      <Text style={s.sumValue}>{value}</Text>
    </View>
  );
}

function KV({ k, v, bold }: { k: string; v: string | null; bold?: boolean }) {
  if (!v) return null;
  return (
    <View style={s.kvRow}>
      <Text style={bold ? s.kvKeyBold : s.kvKey}>{k}</Text>
      <Text style={bold ? s.kvValSm : s.kvVal}>: {v}</Text>
    </View>
  );
}

export function InvoiceDocument({ doc }: { doc: InvoiceDoc }) {
  const t = doc.summary;
  const state = doc.event.state ?? doc.buyer.state;
  const stateText = state ? `${state}${doc.event.stateCode ? ` (${doc.event.stateCode})` : ""}` : null;
  const place = doc.event.placeOfSupply ?? doc.buyer.state;

  return (
    <Document title={`Tax Invoice ${doc.number}`} author={doc.seller.name} subject={`Order ${doc.orderNumber}`}>
      <Page size="A4" style={s.page}>
        {/* From the second page on: some room at the top and the column headings again. Nothing on the first page. */}
        <View
          fixed
          style={{ paddingHorizontal: 26 }}
          render={({ pageNumber }) =>
            pageNumber > 1 ? (
              <View>
                <View style={{ height: 14 }} />
                <View style={s.table}>
                  <TableHead />
                </View>
              </View>
            ) : null
          }
        />
        <View>
          <View style={s.header}>
            <Brand doc={doc} />
            <View style={s.vRule} />
            <View style={s.titleBox}>
              <Text style={s.title}>TAX INVOICE</Text>
              <View style={{ marginTop: 5 }}>
                <Flourish width={130} />
              </View>
              <Text style={s.tagline}>Spaces for your most meaningful moments.</Text>
            </View>
            <View style={s.vRule} />
            <View style={s.meta}>
              <View style={s.metaRow}>
                <Text style={s.metaKey}>Invoice No.</Text>
                <Text style={s.metaNo}>{doc.number}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaKey}>Invoice Date</Text>
                <Text style={s.metaVal}>{day(doc.issuedOn)}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaKey}>Event Selection No.</Text>
                <Text style={s.metaVal}>{doc.quotationNumber ?? doc.orderNumber}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaKey}>Paid On</Text>
                <Text style={s.metaVal}>{day(doc.paidOn)}</Text>
              </View>
              {doc.seller.gstin ? (
                <View style={s.metaRow}>
                  <Text style={s.metaKey}>Our GSTIN</Text>
                  <Text style={s.metaVal}>{doc.seller.gstin}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={s.goldBar} />
        </View>

        <View style={s.body}>
          <View style={s.cards}>
            <View style={s.cardHalf}>
              <Icon name="bill" />
              <View style={s.cardBody}>
                <Text style={s.cardHead}>BILL TO</Text>
                <Text style={s.cardName}>{doc.buyer.name}</Text>
                {doc.buyer.email ? <Text style={s.cardLine}>{doc.buyer.email}</Text> : null}
                {doc.buyer.phone ? <Text style={s.cardLine}>{doc.buyer.phone}</Text> : null}
                {doc.buyer.state ? <Text style={s.cardLine}>{doc.buyer.state}</Text> : null}
                {doc.buyer.gstin ? <Text style={[s.cardLine, { fontWeight: 600 }]}>GSTIN: {doc.buyer.gstin}</Text> : null}
              </View>
            </View>
            <View style={s.cardDivider} />
            <View style={s.cardHalf}>
              <Icon name="event" />
              <View style={s.cardBody}>
                <Text style={s.cardHead}>EVENT DETAILS</Text>
                <KV k="Functions" v={doc.event.functions} />
                <KV k="Event Dates" v={dayRange(doc.event.date, doc.event.dateTo)} />
                <KV k="Venue" v={doc.event.venue ?? "—"} />
                <KV k="State" v={stateText} />
                <KV k="Place of Supply" v={place} />
              </View>
            </View>
          </View>

          <View style={s.table}>
            <TableHead />
            {doc.groups.map((g) => (
              <View key={`${g.title}-${g.date}`}>
                <View style={s.groupRow} minPresenceAhead={40}>
                  <Text style={s.groupTitle}>
                    {g.title.toUpperCase()}
                    {g.date ? ` – ${day(g.date).toUpperCase()}` : ""}
                  </Text>
                </View>
                {g.lines.map((l) => (
                  <View key={l.number} style={s.row} wrap={false}>
                    <View style={[s.cell, s.cNo]}>
                      <Text>{l.number}</Text>
                    </View>
                    <View style={[s.cell, s.cDesc]}>
                      <Text>{l.description}</Text>
                      {l.days > 1 ? <Text style={s.small}>for {l.days} days</Text> : null}
                      {l.remark ? <Text style={s.small}>{l.remark}</Text> : null}
                    </View>
                    <View style={[s.cell, s.cHsn]}>
                      <Text>{l.hsn ?? "—"}</Text>
                    </View>
                    <View style={[s.cell, s.cQty]}>
                      <Text>{l.quantity}</Text>
                    </View>
                    <View style={[s.cell, s.cUnit]}>
                      <Text>{l.unit}</Text>
                    </View>
                    <View style={[s.cell, s.cRate]}>
                      <Text>{money(l.rate)}</Text>
                    </View>
                    <View style={[s.cellLast, s.cAmt]}>
                      <Text>{money(l.amount)}</Text>
                    </View>
                  </View>
                ))}
                <View style={s.subRow} wrap={false}>
                  <View style={{ width: "72.5%", borderRightWidth: 0.5, borderRightColor: C.line }} />
                  <View style={[s.cell, { width: "13%", paddingVertical: 2.4, paddingLeft: 6 }]}>
                    <Text style={{ fontWeight: 700, fontSize: 8 }}>{g.title} Total</Text>
                  </View>
                  <View style={[s.cellLast, { width: "14.5%", paddingVertical: 2.4, paddingRight: 10, alignItems: "flex-end" }]}>
                    <Text style={{ fontWeight: 700, fontSize: 9.5 }}>{money(g.subtotal)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={s.lower} wrap={false}>
            <View style={s.words}>
              <Icon name="words" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={s.wordsHead}>AMOUNT IN WORDS</Text>
                <Text style={s.wordsText}>{doc.amountInWords}</Text>
                {t.discounts > 0 ? (
                  <Text style={[s.small, { marginTop: 7 }]}>
                    Rental charges are after discounts of ₹ {money(t.discounts)} on the items total of ₹ {money(t.itemsTotal)}.
                  </Text>
                ) : null}
                <Text style={[s.small, { marginTop: t.discounts > 0 ? 2 : 7 }]}>
                  GST is charged on the rental charges only. Transportation, installation and the refundable security deposit are
                  shown separately and carry no GST.
                </Text>
              </View>
            </View>
            <View style={s.summary}>
              <SummaryRow label="Rental Charges" value={money(t.rentalCharges)} strong />
              {t.intraState ? (
                <>
                  <SummaryRow label={`CGST @ ${t.halfRate ?? 0}%`} value={money(t.cgst)} />
                  <SummaryRow label={`SGST @ ${t.halfRate ?? 0}%`} value={money(t.sgst)} />
                </>
              ) : (
                <SummaryRow label={`IGST @ ${t.taxRate ?? 0}%`} value={money(t.igst)} />
              )}
              {t.transportationAndHandling > 0 ? <SummaryRow label="Transportation & Handling" value={money(t.transportationAndHandling)} /> : null}
              {t.installationAndDismantling > 0 ? <SummaryRow label="Installation & Dismantling" value={money(t.installationAndDismantling)} /> : null}
              {t.securityDeposit > 0 ? <SummaryRow label="Refundable Security Deposit" value={money(t.securityDeposit)} /> : null}
              <View style={s.grand} wrap={false}>
                <Text style={s.grandLabel}>GRAND TOTAL</Text>
                <Text style={s.grandValue}>₹ {money(t.grandTotal)}</Text>
              </View>
              {t.creditNotesApplied > 0 ? (
                <>
                  <SummaryRow label="Less: Credit Notes Applied" value={`− ${money(t.creditNotesApplied)}`} />
                  <SummaryRow label="Amount Paid" value={money(t.grandTotal - t.creditNotesApplied)} strong />
                </>
              ) : null}
            </View>
          </View>

          <View style={s.foot} wrap={false}>
            <View style={s.payBox}>
              <Icon name="bank" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={s.secHead}>PAYMENT DETAILS</Text>
                <KV k="Account Name" v={doc.seller.name} bold />
                <KV k="Bank Name" v={doc.seller.bankName} bold />
                <KV k="A/C No." v={doc.seller.bankAccount} bold />
                <KV k="IFSC Code" v={doc.seller.bankIfsc} bold />
                <KV k="UPI ID" v={doc.seller.upiId} bold />
                <Text style={[s.small, { marginTop: 4 }]}>Paid in full{doc.paidOn ? ` on ${day(doc.paidOn)}` : ""}</Text>
                {doc.payments.some((p) => p.receiptNumber) ? (
                  // One unbreakable item per receipt, so a number never splits at its hyphens.
                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    <Text style={[s.small, { marginRight: 4 }]}>Receipts:</Text>
                    {doc.payments.map((p) =>
                      p.receiptNumber ? (
                        <Text key={p.receiptNumber} style={[s.small, { marginRight: 5 }]}>
                          {p.receiptNumber}
                        </Text>
                      ) : null,
                    )}
                  </View>
                ) : null}
              </View>
            </View>
            {doc.upiQr ? (
              <View style={s.qrBox}>
                <Text style={{ fontSize: 6.6, fontWeight: 700, letterSpacing: 0.7 }}>SCAN TO PAY</Text>
                <Image src={doc.upiQr} style={s.qr} />
                <Text style={{ fontSize: 6.2, color: C.muted, marginTop: 3 }}>UPI Payment</Text>
              </View>
            ) : (
              <View style={{ width: 16 }} />
            )}
            <View style={s.termsBox}>
              <Icon name="terms" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={s.secHead}>TERMS & NOTES (SUMMARY)</Text>
                {TERMS.map((line) => (
                  <View key={line} style={s.bullet}>
                    <Text style={s.bulletDot}>•</Text>
                    <Text style={s.bulletText}>{line}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Brand doc={doc} small />
          <View style={s.footRule} />
          <View style={s.footMid}>
            <Globe />
            <Text style={s.footSite}>{doc.seller.website ? hostOf(doc.seller.website) : "www.tentvaale.com"}</Text>
          </View>
          <View style={s.footRule} />
          <View style={s.footTag}>
            <Text style={s.footTagText}>MORE THAN DÉCOR.{"\n"}A HIGHER STANDARD.</Text>
            <Text
              style={s.footPage}
              render={({ pageNumber, totalPages }) => (totalPages > 1 ? `${doc.number}  ·  Page ${pageNumber} of ${totalPages}` : doc.number)}
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
