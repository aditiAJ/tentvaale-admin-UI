/**
 * The quotation as a PDF: cover summary, a page per function with its items by category, a picture collection,
 * and a closing page with payment details and terms. Written once and used unchanged by the back office and the
 * storefront (the two copies of this file are identical): it knows nothing of either app, only of the plain
 * QuotationDoc each one fills in.
 */
import { Circle, Document, Font, Image, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";

// Noto Sans carries the rupee sign; Playfair Display is the heading face.
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: "/fonts/NotoSans-Regular.ttf" },
    { src: "/fonts/NotoSans-SemiBold.ttf", fontWeight: 600 },
    { src: "/fonts/NotoSans-Bold.ttf", fontWeight: 700 },
  ],
});
Font.register({ family: "Playfair Display", src: "/fonts/PlayfairDisplay-Bold.woff", fontWeight: 700 });
// Words stay whole, except a very long one (an email address, a UPI id, a web address), which may break so it can never
// run past the edge of its box.
Font.registerHyphenationCallback((word) => (word.length > 18 ? (word.match(/.{1,10}/g) ?? [word]) : [word]));

/** "https://www.example.com/page" -> "www.example.com" */
const hostOf = (url: string) => url.replace(/^https?:\/\//, "").split(/[/?#]/)[0];

export type DocTheme = "light" | "dark";

export interface DocLine {
  name: string;
  variant: string | null;
  quantity: number;
  days: number;
  rate: number;
  amount: number;
  /** "Furniture", "Props" ...; "Items" for a quotation written before lines carried one. */
  category: string;
  /** A key of `QuotationDoc.images`; null when the line has no picture. */
  image: string | null;
}

export interface DocFunction {
  name: string;
  /** yyyy-MM-dd */
  date: string | null;
  /** HH:mm */
  startTime: string | null;
  venue: string | null;
  lines: DocLine[];
}

export interface DocCompany {
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
  /** Data URLs, already loaded; null when the company has none or it could not be fetched. */
  logo: string | null;
  signature: string | null;
}

export interface QuotationDoc {
  number: string;
  /** yyyy-MM-dd */
  issuedOn: string | null;
  validUntil: string | null;
  status: string;
  statusNote: string;
  customerName: string;
  customerEmail: string | null;
  /** yyyy-MM-dd */
  eventDate: string | null;
  venue: string | null;
  functions: DocFunction[];
  subtotal: number | null;
  bundleDiscounts: { label: string; amount: number }[];
  discount: number;
  taxable: number | null;
  taxes: { label: string; amount: number }[];
  delivery: number;
  total: number;
  deposit: { label: string; amount: number };
  policies: string[];
  /** The full text of each policy the quotation was sent with, printed on the last pages. */
  policyTexts: { title: string; version: number; body: string }[];
  company: DocCompany;
  /** Pictures as data URLs, by the key a line names. */
  images: Record<string, string>;
  /** How many pictures on record could not be loaded (they show as plain tiles). */
  picturesMissing: number;
  /** QR codes as data URLs. */
  qr: { upi: string | null; whatsapp: string | null };
}

const PALETTES = {
  light: {
    page: "#fbf8f2",
    card: "#ffffff",
    text: "#1c1812",
    muted: "#6e6657",
    gold: "#a8741f",
    soft: "#f4ead4",
    border: "#e8dcc3",
  },
  dark: {
    page: "#14110c",
    card: "#1c1813",
    text: "#f1ece2",
    muted: "#a89f8e",
    gold: "#d4af37",
    soft: "#2a2416",
    border: "#352f23",
  },
};
const HEAD = "#0c0b09";
const HEAD_GOLD = "#d6b25e";
const HEAD_TEXT = "#f4ead2";

// ---- formatting ----------------------------------------------------------------------------

const number = (value: number, digits = 2) =>
  value.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const rupees = (value: number) => `₹ ${number(value)}`;

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function longDate(iso: string | null | undefined): string | null {
  const d = parse(iso);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : null;
}
function shortDate(iso: string | null | undefined): string | null {
  const d = parse(iso);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}` : null;
}
function clock(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h)) return null;
  return `${String(h % 12 || 12).padStart(2, "0")}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
function dateRange(dates: string[]): string | null {
  const sorted = [...new Set(dates)].sort();
  if (sorted.length === 0) return null;
  const first = parse(sorted[0])!;
  const last = parse(sorted[sorted.length - 1])!;
  if (sorted.length === 1) return longDate(sorted[0]);
  return first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
    ? `${first.getDate()} – ${last.getDate()} ${MONTHS[last.getMonth()]} ${last.getFullYear()}`
    : `${longDate(sorted[0])} – ${longDate(sorted[sorted.length - 1])}`;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : ""));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}
/** "Rupees Five Lakh Fifty Six Thousand Nine Hundred Sixty Only", in the Indian system. */
export function amountInWords(amount: number): string {
  const rupeesPart = Math.floor(Math.round(amount * 100) / 100);
  const paise = Math.round((amount - rupeesPart) * 100);
  const units: [number, string][] = [[10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"]];
  let rest = rupeesPart;
  const words: string[] = [];
  for (const [size, name] of units) {
    if (rest >= size) {
      words.push(`${below1000(Math.floor(rest / size))} ${name}`);
      rest %= size;
    }
  }
  if (rest > 0) words.push(below1000(rest));
  const main = words.length ? words.join(" ") : "Zero";
  return `Rupees ${main}${paise ? ` and ${below1000(paise)} Paise` : ""} Only`;
}

// ---- icons ---------------------------------------------------------------------------------

type IconName = "user" | "calendar" | "pin" | "phone" | "mail" | "globe" | "clock" | "doc";
function Icon({ name, color, size = 14 }: { name: IconName; color: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 1.8, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "user" ? (
        <>
          <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" {...p} />
          <Circle cx={12} cy={7} r={4} {...p} />
        </>
      ) : null}
      {name === "calendar" ? (
        <>
          <Rect x={3} y={4} width={18} height={18} rx={2} {...p} />
          <Path d="M16 2v4M8 2v4M3 10h18" {...p} />
        </>
      ) : null}
      {name === "pin" ? (
        <>
          <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" {...p} />
          <Circle cx={12} cy={10} r={3} {...p} />
        </>
      ) : null}
      {name === "phone" ? (
        <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" {...p} />
      ) : null}
      {name === "mail" ? (
        <>
          <Rect x={2} y={4} width={20} height={16} rx={2} {...p} />
          <Path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" {...p} />
        </>
      ) : null}
      {name === "globe" ? (
        <>
          <Circle cx={12} cy={12} r={10} {...p} />
          <Path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" {...p} />
        </>
      ) : null}
      {name === "clock" ? (
        <>
          <Circle cx={12} cy={12} r={10} {...p} />
          <Path d="M12 6v6l4 2" {...p} />
        </>
      ) : null}
      {name === "doc" ? (
        <>
          <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...p} />
          <Path d="M14 2v6h6M8 13h8M8 17h8" {...p} />
        </>
      ) : null}
    </Svg>
  );
}

// ---- styles --------------------------------------------------------------------------------

function make(theme: DocTheme) {
  const c = PALETTES[theme];
  return {
    c,
    s: StyleSheet.create({
      page: { backgroundColor: c.page, color: c.text, fontFamily: "Noto Sans", fontSize: 9, paddingBottom: 62 },
      // header
      head: { backgroundColor: HEAD, flexDirection: "row", alignItems: "center", paddingHorizontal: 28, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: HEAD_GOLD },
      headBrand: { width: 150, alignItems: "center" },
      headLogo: { width: 62, height: 46, objectFit: "contain" },
      wordmark: { fontFamily: "Playfair Display", fontWeight: 700, color: HEAD_GOLD, fontSize: 15, letterSpacing: 3, textAlign: "center" },
      tagline: { color: HEAD_TEXT, fontSize: 5.5, letterSpacing: 1.6, marginTop: 3, textAlign: "center" },
      divider: { width: 1, alignSelf: "stretch", backgroundColor: HEAD_GOLD, opacity: 0.55, marginHorizontal: 14 },
      headMid: { flex: 1, alignItems: "center" },
      headTitle: { fontFamily: "Playfair Display", fontWeight: 700, color: HEAD_GOLD, fontSize: 14, textAlign: "center", letterSpacing: 0.6 },
      headTitleBig: { fontFamily: "Playfair Display", fontWeight: 700, color: HEAD_GOLD, fontSize: 22, textAlign: "center", letterSpacing: 1 },
      headSub: { color: HEAD_TEXT, fontSize: 8, marginTop: 6, textAlign: "center" },
      orn: { width: 90, height: 1, backgroundColor: HEAD_GOLD, opacity: 0.6, marginTop: 6 },
      headMeta: { width: 168 },
      metaRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 5 },
      metaIcon: { width: 18, paddingTop: 1 },
      metaLabel: { color: HEAD_GOLD, fontSize: 6.5, letterSpacing: 0.8 },
      metaValue: { color: HEAD_TEXT, fontSize: 8.5, marginTop: 1 },
      pageNo: { color: HEAD_GOLD, fontSize: 8, textAlign: "right", marginBottom: 6 },
      // body
      body: { paddingHorizontal: 28, paddingTop: 16 },
      strip: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
      stripCell: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, borderRightWidth: 1, borderRightColor: c.border },
      stripLast: { borderRightWidth: 0 },
      stripIcon: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: c.gold, alignItems: "center", justifyContent: "center", marginRight: 7 },
      stripLabel: { fontSize: 6.5, color: c.gold, letterSpacing: 0.8 },
      stripValue: { fontSize: 8.5, fontWeight: 600, marginTop: 1 },
      sectionTitle: { fontFamily: "Playfair Display", fontWeight: 700, color: c.gold, fontSize: 12, marginTop: 14, marginBottom: 7, letterSpacing: 0.6 },
      // tables
      table: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
      thead: { flexDirection: "row", backgroundColor: HEAD, paddingVertical: 6, paddingHorizontal: 8 },
      th: { color: "#ffffff", fontSize: 7, fontWeight: 600, letterSpacing: 0.4, textAlign: "center" },
      tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: c.border, alignItems: "center" },
      trTotal: { backgroundColor: c.soft },
      cellCenter: { textAlign: "center" },
      cellRight: { textAlign: "right" },
      gold: { color: c.gold, fontWeight: 700 },
      // summary rows
      row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3.5 },
      muted: { color: c.muted },
      // grand total
      grandBox: { backgroundColor: HEAD, borderRadius: 4, borderWidth: 1, borderColor: HEAD_GOLD, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center" },
      grandLabel: { color: HEAD_GOLD, fontFamily: "Playfair Display", fontWeight: 700, fontSize: 10, letterSpacing: 1 },
      grandValue: { color: HEAD_GOLD, fontWeight: 700, fontSize: 24, marginTop: 5 },
      grandWordsLabel: { color: HEAD_GOLD, fontSize: 7.5, marginTop: 8, alignSelf: "flex-start" },
      grandWords: { color: HEAD_TEXT, fontSize: 8.5, marginTop: 2, alignSelf: "flex-start", lineHeight: 1.3 },
      // function detail
      fnHead: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
      fnBadge: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.2, borderColor: c.gold, alignItems: "center", justifyContent: "center", marginRight: 10 },
      fnTitle: { fontFamily: "Playfair Display", fontWeight: 700, color: c.gold, fontSize: 20 },
      fnLine: { fontSize: 9, fontWeight: 600, marginTop: 2 },
      catRow: { flexDirection: "row", alignItems: "center", marginTop: 12, marginBottom: 6 },
      catBadge: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: c.gold, alignItems: "center", justifyContent: "center", marginRight: 8 },
      catTitle: { color: c.gold, fontWeight: 700, fontSize: 10.5, letterSpacing: 0.5 },
      fnTotal: { flexDirection: "row", marginTop: 14, borderWidth: 1, borderColor: c.gold, borderRadius: 3, overflow: "hidden" },
      fnTotalLabel: { flex: 1, backgroundColor: c.soft, paddingVertical: 9, paddingHorizontal: 12, fontFamily: "Playfair Display", fontWeight: 700, color: c.gold, fontSize: 12 },
      fnTotalValue: { width: 190, backgroundColor: c.gold, paddingVertical: 9, textAlign: "center", color: "#ffffff", fontWeight: 700, fontSize: 14 },
      // collection
      catRule: { flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 8 },
      catRuleLine: { flex: 1, height: 1, backgroundColor: c.gold, opacity: 0.5 },
      catRuleText: { color: c.gold, fontSize: 8.5, fontWeight: 600, letterSpacing: 1, marginHorizontal: 10 },
      grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
      tile: { width: 169, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, borderRadius: 3, overflow: "hidden" },
      tileImg: { width: "100%", height: 112, objectFit: "cover" },
      tileBlank: { width: "100%", height: 112, backgroundColor: c.soft, alignItems: "center", justifyContent: "center" },
      tileCode: { position: "absolute", top: 5, left: 5, backgroundColor: "#ffffff", color: "#1c1812", fontSize: 7, fontWeight: 700, paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 2 },
      tileFoot: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, paddingHorizontal: 8 },
      note: { marginTop: 12, borderWidth: 1, borderColor: c.border, paddingVertical: 6, paddingHorizontal: 10, color: c.muted, fontSize: 8 },
      // terms
      pair: { flexDirection: "row", gap: 14 },
      panel: { flex: 1, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
      panelHead: { backgroundColor: HEAD, color: "#ffffff", textAlign: "center", paddingVertical: 7, fontSize: 9, fontWeight: 600, letterSpacing: 0.6 },
      panelBody: { padding: 8 },
      termCols: { flexDirection: "row", gap: 18 },
      term: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: c.border },
      termDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: HEAD, marginRight: 8, alignItems: "center", justifyContent: "center" },
      termDotCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: HEAD_GOLD },
      termTitle: { color: c.gold, fontWeight: 700, fontSize: 8.5, letterSpacing: 0.4 },
      termText: { color: c.text, fontSize: 8, marginTop: 1.5, lineHeight: 1.3 },
      notes: { marginTop: 6, backgroundColor: c.soft, borderWidth: 1, borderColor: c.border, padding: 7, flexDirection: "row", gap: 14 },
      confirm: { marginTop: 6, flexDirection: "row", borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
      sigLine: { flexDirection: "row", marginTop: 11 },
      sigRule: { flex: 1, borderBottomWidth: 1, borderBottomColor: c.muted, marginLeft: 6 },
      // footer
      foot: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: HEAD, borderTopWidth: 2, borderTopColor: HEAD_GOLD, flexDirection: "row", alignItems: "center", paddingHorizontal: 28, paddingVertical: 10 },
      footBrand: { width: 150 },
      footCol: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0, paddingRight: 8 },
      footText: { color: HEAD_TEXT, fontSize: 7.5, flex: 1 },
    }),
  };
}

type Styles = ReturnType<typeof make>["s"];

// ---- pieces --------------------------------------------------------------------------------

function Brand({ s, company, small }: { s: Styles; company: DocCompany; small?: boolean }) {
  return company.logo ? (
    // eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt text
    <Image src={company.logo} style={small ? { width: 52, height: 30, objectFit: "contain" } : s.headLogo} />
  ) : (
    <View>
      <Text style={[s.wordmark, small ? { fontSize: 11, textAlign: "left" } : {}]}>{company.name.toUpperCase()}</Text>
      <Text style={[s.tagline, small ? { textAlign: "left" } : {}]}>EXPERIENCES, ELEVATED.</Text>
    </View>
  );
}

function Header({
  s,
  doc,
  title,
  subtitle,
  big,
  meta,
}: {
  s: Styles;
  doc: QuotationDoc;
  title: string;
  subtitle?: string;
  big?: boolean;
  meta: { icon: IconName; label: string; value: string }[];
}) {
  return (
    <View fixed>
      <View style={s.head}>
        <View style={s.headBrand}>
          <Brand s={s} company={doc.company} />
          {doc.company.logo ? <Text style={[s.wordmark, { fontSize: 12, marginTop: 3 }]}>{doc.company.name.toUpperCase()}</Text> : null}
        </View>
        <View style={s.divider} />
        <View style={s.headMid}>
          <Text style={big ? s.headTitleBig : s.headTitle}>{title}</Text>
          <View style={s.orn} />
          {subtitle ? <Text style={s.headSub}>{subtitle}</Text> : null}
        </View>
        <View style={s.divider} />
        <View style={s.headMeta}>
          <Text style={s.pageNo} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          {meta.map((m) => (
            <View style={s.metaRow} key={m.label}>
              <View style={s.metaIcon}>
                <Icon name={m.icon} color={HEAD_GOLD} size={12} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.metaLabel}>{m.label}</Text>
                <Text style={s.metaValue}>{m.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function Footer({ s, company }: { s: Styles; company: DocCompany }) {
  return (
    <View style={s.foot} fixed>
      <View style={s.footBrand}>
        <Brand s={s} company={company} small />
      </View>
      {company.phone ? (
        <View style={s.footCol}>
          <Icon name="phone" color={HEAD_GOLD} size={11} />
          <Text style={s.footText}>{company.phone}</Text>
        </View>
      ) : null}
      {company.email ? (
        <View style={s.footCol}>
          <Icon name="mail" color={HEAD_GOLD} size={11} />
          <Text style={s.footText}>{company.email}</Text>
        </View>
      ) : null}
      {company.website ? (
        <View style={s.footCol}>
          <Icon name="globe" color={HEAD_GOLD} size={11} />
          <Text style={s.footText}>{hostOf(company.website)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Row({ s, label, value, bold }: { s: Styles; label: string; value: string; bold?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={bold ? { fontWeight: 600 } : s.muted}>{label}</Text>
      <Text style={bold ? { fontWeight: 600 } : undefined}>{value}</Text>
    </View>
  );
}

const STATIC_TERMS: [string, string][] = [
  ["BOOKING & CONFIRMATION", "50% advance to confirm the booking. Balance 50% before dispatch or installation."],
  ["PAYMENT TERMS", "Payments to be made as per agreed milestones. All payments are non-refundable."],
  ["TRANSPORTATION", "Transportation, loading & unloading are included within the city limit."],
  ["DAMAGE & BREAKAGE", "Client to inform immediately. Charges applicable for any damage or breakage."],
  ["INSTALLATION & DISMANTLING", "Installation & dismantling are included in the quote for the scheduled event dates."],
  ["FORCE MAJEURE", "We are not liable for delays or non-performance due to natural calamities, strikes, or any unforeseen events beyond our control."],
  ["CANCELLATION", "Cancellation must be informed in writing. Cancellation charges will apply as per timeline."],
  ["OTHERS", "Any additional items or services requested on-site will be charged extra."],
];

const STATIC_INCLUDED = ["Delivery & Installation", "On-site Supervision", "Basic Tool Kit & Ancillaries", "Standard Packing & Handling"];

// ---- the document --------------------------------------------------------------------------

export function QuotationDocument({ doc, theme }: { doc: QuotationDoc; theme: DocTheme }) {
  const { s, c } = make(theme);
  const co = doc.company;

  const functions = doc.functions.filter((f) => f.lines.length > 0);
  const dates = functions.map((f) => f.date).filter((d): d is string => Boolean(d));
  const eventDates = dateRange(dates) ?? longDate(doc.eventDate) ?? "To be confirmed";
  const venue = doc.venue ?? functions.find((f) => f.venue)?.venue ?? "To be confirmed";
  const issued = longDate(doc.issuedOn);
  const until = longDate(doc.validUntil);

  const metaFull = [
    { icon: "doc" as const, label: "QUOTATION NO.", value: doc.number },
    ...(issued ? [{ icon: "calendar" as const, label: "DATE", value: issued }] : []),
    ...(until ? [{ icon: "clock" as const, label: "VALID UNTIL", value: until }] : []),
  ];
  const metaEvent = [
    { icon: "calendar" as const, label: "EVENT DATES", value: eventDates },
    { icon: "pin" as const, label: "VENUE", value: venue },
    { icon: "user" as const, label: "CURATED FOR", value: doc.customerName },
  ];

  // Categories in the order they first appear; the cover table shows the first four and folds the rest into one.
  const categoryTotals = new Map<string, number>();
  for (const f of functions) for (const l of f.lines) categoryTotals.set(l.category, (categoryTotals.get(l.category) ?? 0) + l.amount);
  const categories = [...categoryTotals.keys()];
  const shown = categories.slice(0, 4);
  const hasOther = categories.length > 4;
  const columns = hasOther ? [...shown, "Other"] : shown;
  const amountIn = (f: DocFunction, column: string) =>
    f.lines
      .filter((l) => (column === "Other" ? !shown.includes(l.category) : l.category === column))
      .reduce((sum, l) => sum + l.amount, 0);
  const functionTotal = (f: DocFunction) => f.lines.reduce((sum, l) => sum + l.amount, 0);
  const colWidth = 60;

  // The collection pages are part of the document whenever any item has a picture on record, loaded or not.
  const imageLines = functions.some((f) => f.lines.some((l) => l.image));
  const codeOf = (f: DocFunction, index: number) => `${(f.name.trim()[0] ?? "S").toUpperCase()}-${String(index + 1).padStart(2, "0")}`;
  /** Item codes follow the order of the detail page (by category), so a picture and its row carry the same code. */
  const codes = new Map<DocLine, string>();
  for (const f of functions) {
    let index = 0;
    const groups = new Map<string, DocLine[]>();
    for (const l of f.lines) groups.set(l.category, [...(groups.get(l.category) ?? []), l]);
    for (const lines of groups.values()) for (const l of lines) codes.set(l, codeOf(f, index++));
  }
  const byCategory = (f: DocFunction) => {
    const groups = new Map<string, DocLine[]>();
    for (const l of f.lines) groups.set(l.category, [...(groups.get(l.category) ?? []), l]);
    return [...groups.entries()];
  };

  return (
    <Document title={`Quotation ${doc.number}`} author={co.name} subject={`Quotation for ${doc.customerName}`}>
      {/* ---------------- cover ---------------- */}
      <Page size="A4" style={s.page}>
        <Header
          s={s}
          doc={doc}
          big
          title="EVENT SELECTION"
          subtitle="Your Event. Your Selection."
          meta={[...metaFull, { icon: "doc", label: "STATUS", value: `${doc.status} · ${doc.statusNote}` }]}
        />
        <View style={s.body}>
          <View style={s.strip}>
            {[
              { icon: "user" as const, label: "CURATED FOR", value: doc.customerName },
              { icon: "mail" as const, label: "CONTACT", value: doc.customerEmail ?? "—", grow: 1.5 },
              { icon: "calendar" as const, label: "EVENT DATES", value: eventDates },
              { icon: "pin" as const, label: "VENUE", value: venue },
            ].map((cell, index, all) => (
              <View
                key={cell.label}
                style={[s.stripCell, index === all.length - 1 ? s.stripLast : {}, "grow" in cell ? { flexGrow: cell.grow } : {}]}
              >
                <View style={s.stripIcon}>
                  <Icon name={cell.icon} color={c.gold} size={12} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.stripLabel}>{cell.label}</Text>
                  <Text style={s.stripValue}>{cell.value}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={s.sectionTitle}>01.  EVENT WISE SUMMARY</Text>
          <View style={s.table}>
            <View style={s.thead}>
              <Text style={[s.th, { flex: 1, textAlign: "left" }]}>FUNCTION / EVENT</Text>
              <Text style={[s.th, { width: 70 }]}>DATE</Text>
              {columns.map((col) => (
                <Text key={col} style={[s.th, { width: colWidth }]}>
                  {col.toUpperCase()} (₹)
                </Text>
              ))}
              <Text style={[s.th, { width: 72, color: HEAD_GOLD }]}>SUBTOTAL (₹)</Text>
            </View>
            {functions.map((f) => (
              <View style={s.tr} key={f.name} wrap={false}>
                <Text style={{ flex: 1, fontWeight: 600 }}>{f.name.toUpperCase()}</Text>
                <Text style={[s.cellCenter, { width: 70, fontSize: 8 }]}>{shortDate(f.date) ?? "—"}</Text>
                {columns.map((col) => (
                  <Text key={col} style={[s.cellCenter, { width: colWidth }]}>
                    {number(amountIn(f, col), 0)}
                  </Text>
                ))}
                <Text style={[s.cellCenter, s.gold, { width: 72 }]}>{number(functionTotal(f), 0)}</Text>
              </View>
            ))}
            <View style={[s.tr, s.trTotal]} wrap={false}>
              <Text style={{ flex: 1, fontWeight: 700 }}>TOTAL</Text>
              <Text style={{ width: 70 }} />
              {columns.map((col) => (
                <Text key={col} style={[s.cellCenter, s.gold, { width: colWidth }]}>
                  {number(functions.reduce((sum, f) => sum + amountIn(f, col), 0), 0)}
                </Text>
              ))}
              <Text style={[s.cellCenter, s.gold, { width: 72, fontSize: 10.5 }]}>
                {number(functions.reduce((sum, f) => sum + functionTotal(f), 0), 0)}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }} wrap={false}>
            <View style={{ flex: 1 }}>
              <Text style={s.sectionTitle}>02.  COMMERCIAL SUMMARY</Text>
              {doc.subtotal != null ? <Row s={s} label="Subtotal (Before Taxes)" value={number(doc.subtotal)} /> : null}
              {doc.bundleDiscounts.map((d) => (
                <Row key={d.label} s={s} label={d.label} value={`− ${number(d.amount)}`} />
              ))}
              {doc.discount > 0 ? <Row s={s} label="Discount" value={`− ${number(doc.discount)}`} /> : null}
              {doc.taxable != null ? (
                <View style={{ borderTopWidth: 1, borderTopColor: c.border, marginTop: 4, paddingTop: 4 }}>
                  <Row s={s} label="Taxable Amount" value={number(doc.taxable)} />
                </View>
              ) : null}
              {doc.taxes.map((t) => (
                <Row key={t.label} s={s} label={t.label} value={number(t.amount)} />
              ))}
              {doc.delivery > 0 ? <Row s={s} label="Delivery / Transportation" value={number(doc.delivery)} /> : null}
              <View style={{ borderTopWidth: 1, borderTopColor: c.border, marginTop: 4, paddingTop: 4 }}>
                <Row s={s} label={doc.deposit.label} value={number(doc.deposit.amount)} />
              </View>
            </View>
            <View style={{ width: 245, marginTop: 20 }}>
              <View style={s.grandBox}>
                <Text style={s.grandLabel}>GRAND TOTAL</Text>
                <Text style={s.grandValue}>{rupees(doc.total)}</Text>
                <Text style={s.grandWordsLabel}>Amount in Words</Text>
                <Text style={s.grandWords}>{amountInWords(doc.total)}</Text>
              </View>
            </View>
          </View>

          <View wrap={false}>
            <Text style={[s.sectionTitle, { textAlign: "center", marginTop: 16 }]}>WHAT&apos;S INCLUDED</Text>
            <View style={[s.table, { flexDirection: "row", paddingVertical: 10 }]}>
              {STATIC_INCLUDED.map((item, index) => (
                <View
                  key={item}
                  style={{ flex: 1, alignItems: "center", paddingHorizontal: 6, borderLeftWidth: index ? 1 : 0, borderLeftColor: c.border }}
                >
                  <Text style={{ fontSize: 8.5, textAlign: "center" }}>{item}</Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: "row", marginTop: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 10, alignItems: "center" }}>
              {doc.qr.whatsapp ? (
                <View style={{ flexDirection: "row", alignItems: "center", width: 200 }}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt text */}
                  <Image src={doc.qr.whatsapp} style={{ width: 58, height: 58, marginRight: 8 }} />
                  <View>
                    <Text style={{ fontSize: 8, fontWeight: 600 }}>Scan to WhatsApp us</Text>
                    {co.phone ? <Text style={[s.muted, { fontSize: 8, marginTop: 2 }]}>{co.phone}</Text> : null}
                  </View>
                </View>
              ) : null}
              <View style={{ flex: 1, paddingHorizontal: 12 }}>
                <Text style={{ fontSize: 9, fontWeight: 600 }}>Thank you for considering {co.name}.</Text>
                <Text style={[s.muted, { fontSize: 8, marginTop: 2 }]}>We look forward to being a part of your special event.</Text>
              </View>
              <View style={{ width: 150, alignItems: "center" }}>
                <Text style={{ fontSize: 8, alignSelf: "flex-start" }}>For {co.name.toUpperCase()}</Text>
                {co.signature ? (
                  // eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt text
                  <Image src={co.signature} style={{ width: 90, height: 34, objectFit: "contain", marginVertical: 3 }} />
                ) : (
                  <View style={{ height: 34 }} />
                )}
                <Text style={[s.muted, { fontSize: 7.5, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 3, alignSelf: "stretch", textAlign: "center" }]}>
                  Authorised Signatory
                </Text>
              </View>
            </View>
          </View>
        </View>
        <Footer s={s} company={co} />
      </Page>

      {/* ---------------- one page per function ---------------- */}
      {functions.map((f, fi) => {
        let n = 0;
        return (
          <Page key={`fn-${f.name}-${fi}`} size="A4" style={s.page}>
            <Header s={s} doc={doc} title="DETAILED SELECTION & ESTIMATE" subtitle={`Quotation No. : ${doc.number}`} meta={metaEvent} />
            <View style={s.body}>
              <View style={s.fnHead} wrap={false}>
                <View style={s.fnBadge}>
                  <Text style={{ color: c.gold, fontWeight: 700, fontSize: 12 }}>{String(fi + 1).padStart(2, "0")}</Text>
                </View>
                <View>
                  <Text style={s.fnTitle}>{f.name.toUpperCase()}</Text>
                  <Text style={s.fnLine}>
                    {[longDate(f.date)?.toUpperCase(), clock(f.startTime) ? `${clock(f.startTime)} ONWARDS` : null].filter(Boolean).join("   |   ") ||
                      "Date and time to be confirmed"}
                  </Text>
                  {f.venue ? <Text style={s.muted}>Venue: {f.venue}</Text> : null}
                </View>
              </View>

              {byCategory(f).map(([category, lines], ci) => (
                <View key={category}>
                  <View style={s.catRow} minPresenceAhead={70}>
                    <View style={s.catBadge}>
                      <Text style={{ color: c.gold, fontSize: 8, fontWeight: 700 }}>{String.fromCharCode(65 + ci)}</Text>
                    </View>
                    <Text style={s.catTitle}>
                      {String.fromCharCode(65 + ci)}.  {category.toUpperCase()}
                    </Text>
                  </View>
                  <View style={s.table}>
                    <View style={s.thead} fixed>
                      <Text style={[s.th, { width: 36 }]}>#</Text>
                      <Text style={[s.th, { flex: 1 }]}>ITEM</Text>
                      <Text style={[s.th, { width: 52 }]}>QTY</Text>
                      <Text style={[s.th, { width: 66 }]}>RATE (₹)</Text>
                      <Text style={[s.th, { width: 40 }]}>DAYS</Text>
                      <Text style={[s.th, { width: 78 }]}>AMOUNT (₹)</Text>
                    </View>
                    {lines.map((l) => {
                      n += 1;
                      return (
                        <View style={s.tr} key={`${l.name}-${n}`} wrap={false}>
                          <Text style={[s.cellCenter, s.gold, { width: 36, fontSize: 8 }]}>{codes.get(l)}</Text>
                          <View style={{ flex: 1, paddingHorizontal: 6 }}>
                            <Text style={{ fontWeight: 600 }}>{l.name}</Text>
                            {l.variant ? <Text style={[s.muted, { fontSize: 7.5, marginTop: 1 }]}>{l.variant}</Text> : null}
                          </View>
                          <Text style={[s.cellCenter, { width: 52 }]}>{l.quantity}</Text>
                          <Text style={[s.cellCenter, { width: 66 }]}>{number(l.rate)}</Text>
                          <Text style={[s.cellCenter, { width: 40 }]}>{l.days}</Text>
                          <Text style={[s.cellCenter, { width: 78 }]}>{number(l.amount)}</Text>
                        </View>
                      );
                    })}
                    <View style={[s.tr, s.trTotal]} wrap={false}>
                      <Text style={{ flex: 1, textAlign: "right", fontWeight: 700, paddingRight: 10, fontSize: 8 }}>
                        {category.toUpperCase()} TOTAL
                      </Text>
                      <Text style={[s.cellCenter, s.gold, { width: 78, fontSize: 10.5 }]}>
                        {number(lines.reduce((sum, l) => sum + l.amount, 0))}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}

              <View style={s.fnTotal} wrap={false}>
                <Text style={s.fnTotalLabel}>{f.name.toUpperCase()} SELECTION TOTAL</Text>
                <Text style={s.fnTotalValue}>{rupees(functionTotal(f))}</Text>
              </View>
            </View>
            <Footer s={s} company={co} />
          </Page>
        );
      })}

      {/* ---------------- picture collection ---------------- */}
      {imageLines ? (
        <Page size="A4" style={s.page}>
          <Header s={s} doc={doc} title="SELECTED COLLECTION" subtitle="A VISUAL REFERENCE OF YOUR SELECTIONS" meta={metaEvent} />
          <View style={s.body}>
            {functions.map((f, fi) => (
              <View key={`col-${f.name}-${fi}`} wrap>
                <View style={[s.fnHead, { marginTop: fi ? 14 : 0 }]}>
                  <View style={s.fnBadge}>
                    <Text style={{ color: c.gold, fontWeight: 700, fontSize: 12 }}>{String(fi + 1).padStart(2, "0")}</Text>
                  </View>
                  <View>
                    <Text style={[s.fnTitle, { fontSize: 15 }]}>{f.name.toUpperCase()} COLLECTION</Text>
                    <Text style={s.fnLine}>
                      {[longDate(f.date)?.toUpperCase(), clock(f.startTime) ? `${clock(f.startTime)} ONWARDS` : null].filter(Boolean).join("   |   ")}
                    </Text>
                  </View>
                </View>
                {byCategory(f).map(([category, lines]) => (
                  <View key={category} wrap={lines.length > 6}>
                    <View style={s.catRule}>
                      <View style={s.catRuleLine} />
                      <Text style={s.catRuleText}>{category.toUpperCase()}</Text>
                      <View style={s.catRuleLine} />
                    </View>
                    <View style={s.grid}>
                      {lines.map((l, li) => {
                        const src = l.image ? doc.images[l.image] : null;
                        return (
                          <View style={s.tile} key={`${l.name}-${li}`} wrap={false}>
                            <View>
                              {src ? (
                                // eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt text
                                <Image src={src} style={s.tileImg} />
                              ) : (
                                <View style={s.tileBlank}>
                                  <Text style={{ color: c.gold, fontFamily: "Playfair Display", fontWeight: 700, fontSize: 26 }}>
                                    {l.name.trim()[0]?.toUpperCase()}
                                  </Text>
                                </View>
                              )}
                              <Text style={s.tileCode}>{codes.get(l)}</Text>
                            </View>
                            <View style={s.tileFoot}>
                              <Text style={{ fontSize: 8, fontWeight: 600, flex: 1, paddingRight: 4 }}>
                                {l.name}
                                {l.variant ? ` · ${l.variant}` : ""}
                              </Text>
                              <Text style={{ fontSize: 8, color: c.gold }}>{l.quantity} Nos.</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
                <View style={{ alignSelf: "flex-end", marginTop: 8, flexDirection: "row", borderWidth: 1, borderColor: c.border }} wrap={false}>
                  <Text style={{ paddingVertical: 6, paddingHorizontal: 12, fontSize: 8.5, fontWeight: 600 }}>{f.name.toUpperCase()} TOTAL</Text>
                  <Text style={{ backgroundColor: c.gold, color: "#ffffff", fontWeight: 700, paddingVertical: 6, paddingHorizontal: 14, fontSize: 10.5 }}>
                    {rupees(functionTotal(f))}
                  </Text>
                </View>
              </View>
            ))}
            <Text style={s.note}>NOTE: Images are for reference only. Actual products may vary slightly in colour, texture &amp; finish.</Text>
          </View>
          <Footer s={s} company={co} />
        </Page>
      ) : null}

      {/* ---------------- payment, terms, confirmation ---------------- */}
      <Page size="A4" style={s.page}>
        <Header s={s} doc={doc} title="TERMS, PAYMENT & CONFIRMATION" subtitle={`Quotation No. : ${doc.number}`} meta={metaEvent} />
        <View style={s.body}>
          <View style={[s.pair, { marginTop: -4 }]} wrap={false}>
            <View style={s.panel}>
              <Text style={s.panelHead}>PAYMENT DETAILS</Text>
              <View style={[s.panelBody, { flexDirection: "row" }]}>
                {doc.qr.upi ? (
                  <View style={{ width: 84, alignItems: "center", marginRight: 10 }}>
                    <Text style={{ fontSize: 7.5, marginBottom: 4 }}>SCAN TO PAY</Text>
                    {/* eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt text */}
                    <Image src={doc.qr.upi} style={{ width: 72, height: 72 }} />
                    <Text style={{ fontSize: 7, marginTop: 4, fontWeight: 600 }}>UPI ID</Text>
                    <Text style={{ fontSize: 7, textAlign: "center", maxWidth: 84 }}>{co.upiId}</Text>
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.gold, fontWeight: 700, fontSize: 8, marginBottom: 3 }}>BANK TRANSFER</Text>
                  <Text style={{ fontWeight: 700, marginBottom: 4 }}>{co.name}</Text>
                  {[
                    ["Bank Name", co.bankName],
                    ["A/C No.", co.bankAccount],
                    ["IFSC Code", co.bankIfsc],
                  ]
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <View key={label} style={{ flexDirection: "row", paddingVertical: 2 }}>
                        <Text style={[s.muted, { width: 52, fontSize: 8 }]}>{label}</Text>
                        <Text style={{ flex: 1, fontSize: 8, minWidth: 0 }}>{value}</Text>
                      </View>
                    ))}
                  {!co.bankName && !co.bankAccount && !co.upiId ? (
                    <Text style={s.muted}>Payment details will be shared on confirmation.</Text>
                  ) : null}
                  {co.gstin || co.pan ? (
                    <Text style={{ fontSize: 7.5, marginTop: 4 }}>
                      {[co.gstin && `GSTIN ${co.gstin}`, co.pan && `PAN ${co.pan}`].filter(Boolean).join("   ·   ")}
                    </Text>
                  ) : null}
                  {co.phone ? <Text style={{ color: c.gold, fontSize: 7.5, marginTop: 6 }}>Please share the payment screenshot on {co.phone}</Text> : null}
                </View>
              </View>
            </View>

            <View style={s.panel}>
              <Text style={s.panelHead}>COMMERCIAL SUMMARY</Text>
              <View style={s.panelBody}>
                {functions.map((f, i) => (
                  <View key={f.name} style={[s.row, { paddingVertical: 2 }]}>
                    <Text>
                      {i + 1}.  {f.name}
                      {f.date ? ` (${shortDate(f.date)?.slice(0, -5)})` : ""}
                    </Text>
                    <Text>{rupees(functionTotal(f))}</Text>
                  </View>
                ))}
                <View style={{ borderTopWidth: 1, borderTopColor: c.border, marginTop: 4, paddingTop: 4 }}>
                  {doc.subtotal != null ? <Row s={s} label="SUB TOTAL" value={rupees(doc.subtotal)} bold /> : null}
                  {doc.taxes.map((t) => (
                    <Row key={t.label} s={s} label={t.label} value={rupees(t.amount)} />
                  ))}
                  {doc.delivery > 0 ? <Row s={s} label="Delivery" value={rupees(doc.delivery)} /> : null}
                </View>
                <View style={{ flexDirection: "row", marginTop: 6, borderWidth: 1, borderColor: c.gold }}>
                  <Text style={{ flex: 1, backgroundColor: c.soft, color: c.gold, fontWeight: 700, paddingVertical: 6, paddingHorizontal: 8 }}>GRAND TOTAL</Text>
                  <Text style={{ backgroundColor: c.gold, color: "#ffffff", fontWeight: 700, paddingVertical: 6, paddingHorizontal: 10, fontSize: 11 }}>{rupees(doc.total)}</Text>
                </View>
                <Text style={[s.muted, { fontSize: 7, marginTop: 4 }]}>{doc.deposit.label}: {rupees(doc.deposit.amount)}</Text>
              </View>
            </View>
          </View>

          <Text style={[s.sectionTitle, { textAlign: "center", marginTop: 10, marginBottom: 3 }]}>TERMS &amp; CONDITIONS</Text>
          <View style={s.termCols} wrap={false}>
            {[STATIC_TERMS.slice(0, 4), STATIC_TERMS.slice(4)].map((column, ci) => (
              <View key={ci} style={{ flex: 1 }}>
                {column.map(([title, text]) => (
                  <View style={s.term} key={title}>
                    <View style={s.termDot}>
                      <View style={s.termDotCore} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.termTitle}>{title}</Text>
                      <Text style={s.termText}>{text}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
          {doc.policies.length > 0 ? (
            <Text style={[s.muted, { fontSize: 7.5, marginTop: 6 }]}>This quotation is subject to our {doc.policies.join(", ")}.</Text>
          ) : null}

          <View style={s.notes} wrap={false}>
            <Text style={{ color: c.gold, fontWeight: 700, fontSize: 8.5, width: 80 }}>IMPORTANT NOTES</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.termText}>•  All measurements are approximate.</Text>
              <Text style={s.termText}>•  Colours &amp; textures may vary slightly from images.</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.termText}>•  Items are subject to availability.</Text>
              <Text style={s.termText}>•  {co.name} reserves the right to substitute with an equivalent item if required.</Text>
            </View>
          </View>

          <View style={s.confirm} wrap={false}>
            <View style={{ flex: 1, padding: 12, borderRightWidth: 1, borderRightColor: c.border }}>
              <Text style={{ color: c.gold, fontWeight: 700, fontSize: 9, marginBottom: 4 }}>CONFIRM YOUR SELECTION</Text>
              <Text style={s.termText}>We would love to bring your vision to life. Kindly review the selection and let us know your confirmation.</Text>
              <Text style={[s.termText, { marginTop: 4, fontWeight: 600 }]}>
                {[co.phone, co.email].filter(Boolean).join("   ·   ")}
              </Text>
            </View>
            <View style={{ flex: 1, padding: 12 }}>
              <Text style={{ color: c.gold, fontWeight: 700, fontSize: 9, marginBottom: 2 }}>AUTHORISED SIGNATORY</Text>
              {co.signature ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt text
                <Image src={co.signature} style={{ width: 90, height: 30, objectFit: "contain" }} />
              ) : null}
              {["Name:", "Signature:", "Date:"].map((label) => (
                <View style={s.sigLine} key={label}>
                  <Text style={s.muted}>{label}</Text>
                  <View style={s.sigRule} />
                </View>
              ))}
              <Text style={[s.muted, { fontSize: 7, marginTop: 8, textAlign: "center" }]}>{co.name}</Text>
            </View>
          </View>
        </View>
        <Footer s={s} company={co} />
      </Page>

      {/* ---------------- the policies, in full ---------------- */}
      {doc.policyTexts.length > 0 ? (
        <Page size="A4" style={s.page}>
          <Header s={s} doc={doc} title="POLICIES" subtitle={`Quotation No. : ${doc.number}`} meta={metaEvent} />
          <View style={s.body}>
            {doc.policyTexts.map((policy) => (
              <View key={`${policy.title}-${policy.version}`} style={{ marginBottom: 14 }}>
                <View minPresenceAhead={60}>
                  <Text style={{ fontFamily: "Playfair Display", fontWeight: 700, color: c.gold, fontSize: 13 }}>{policy.title}</Text>
                  <Text style={[s.muted, { fontSize: 7.5, marginTop: 2, marginBottom: 6 }]}>Version {policy.version}</Text>
                </View>
                {policy.body
                  .split(/\n{2,}/)
                  .map((paragraph) => paragraph.trim())
                  .filter(Boolean)
                  .map((paragraph, index) => (
                    <Text key={index} style={{ fontSize: 8.5, lineHeight: 1.45, marginBottom: 5 }}>
                      {paragraph}
                    </Text>
                  ))}
              </View>
            ))}
          </View>
          <Footer s={s} company={co} />
        </Page>
      ) : null}
    </Document>
  );
}
