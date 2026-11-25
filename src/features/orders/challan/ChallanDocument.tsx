/**
 * An order's delivery challan as a PDF, in the quotation's header and footer: every item of the order with its picture and a
 * box to tick as it is loaded, then a place for each side to sign. It carries no number of its own; it is known by the order.
 */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  Footer,
  HEAD,
  Header,
  longDate,
  make,
  type DocCompany,
  type DocTheme,
  type IconName,
} from "@/features/quotations/components/QuotationDocument";

export interface ChallanEntry {
  name: string;
  variant: string | null;
  remark: string | null;
  /** "Haldi · 25 Oct 2026"; null when the quotation has no functions. */
  occasion: string | null;
  quantity: number;
  /** What the quantity counts when it is not pieces ("SQ FT", "RFT"); null for pieces. */
  unit: string | null;
  /** A key of `ChallanDoc.images`; null when there is no picture. */
  image: string | null;
}

export interface ChallanDoc {
  orderNumber: string;
  quotationNumber: string | null;
  /** yyyy-MM-dd */
  preparedOn: string;
  eventDate: string | null;
  venue: string | null;
  customer: { name: string; phone: string | null; email: string | null; address: string | null; gstin: string | null };
  entries: ChallanEntry[];
  company: DocCompany;
  images: Record<string, string>;
  picturesMissing: number;
}

const PHOTO = 58;

function styles(c: ReturnType<typeof make>["c"]) {
  return StyleSheet.create({
    party: { flexDirection: "row", gap: 14, marginTop: 10 },
    partyBox: { flex: 1, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 8 },
    partyLabel: { color: c.gold, fontSize: 7, fontWeight: 700, letterSpacing: 0.8, marginBottom: 3 },
    partyName: { fontWeight: 700, fontSize: 10 },
    partyLine: { color: c.muted, fontSize: 8, marginTop: 1.5 },
    headRow: { flexDirection: "row", alignItems: "center", backgroundColor: HEAD, paddingVertical: 6, paddingHorizontal: 8, marginTop: 12 },
    th: { color: "#ffffff", fontSize: 7, fontWeight: 600, letterSpacing: 0.4 },
    row: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 8, borderWidth: 1, borderTopWidth: 0, borderColor: c.border, backgroundColor: c.card },
    tick: { width: 34, alignItems: "center" },
    box: { width: 13, height: 13, borderWidth: 1.2, borderColor: c.text },
    no: { width: 24, color: c.muted, fontSize: 8 },
    photo: { width: PHOTO + 10, alignItems: "center" },
    photoBox: { width: PHOTO, height: PHOTO, borderWidth: 1, borderColor: c.border, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
    photoImg: { width: PHOTO - 2, height: PHOTO - 2, objectFit: "contain" },
    item: { flex: 1, paddingRight: 8 },
    name: { fontWeight: 700, fontSize: 9.5 },
    chip: { alignSelf: "flex-start", backgroundColor: c.soft, fontSize: 7.5, fontWeight: 600, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginTop: 3 },
    detail: { color: c.muted, fontSize: 7.5, marginTop: 3 },
    remark: { fontSize: 7.5, marginTop: 3, paddingLeft: 6, borderLeftWidth: 2, borderLeftColor: c.gold },
    qty: { width: 64, alignItems: "flex-end" },
    qtyValue: { color: c.gold, fontWeight: 700, fontSize: 16, lineHeight: 1 },
    qtyLabel: { color: c.muted, fontSize: 6, letterSpacing: 0.8, marginTop: 2 },
    sign: { flexDirection: "row", gap: 30, marginTop: 34 },
    signBox: { flex: 1 },
    signSpace: { height: 62, borderBottomWidth: 1, borderBottomColor: c.text },
    signWho: { fontWeight: 700, fontSize: 9, marginTop: 5 },
    signLine: { color: c.muted, fontSize: 7.5, marginTop: 8 },
  });
}

export function ChallanDocument({ doc, theme }: { doc: ChallanDoc; theme: DocTheme }) {
  const { s, c } = make(theme);
  const x = styles(c);
  const co = doc.company;
  const meta = [
    { icon: "doc" as IconName, label: "ORDER NO.", value: doc.orderNumber },
    { icon: "calendar" as IconName, label: "EVENT DATE", value: longDate(doc.eventDate) ?? "To be confirmed" },
    { icon: "pin" as IconName, label: "VENUE", value: doc.venue ?? "To be confirmed" },
    { icon: "user" as IconName, label: "CUSTOMER", value: doc.customer.name },
  ];
  const subtitle = doc.quotationNumber ? `Order ${doc.orderNumber} · from ${doc.quotationNumber}` : `Order ${doc.orderNumber}`;
  // Pieces only: square feet and running feet are not units, and adding them to pieces would mean nothing.
  const pieces = doc.entries.reduce((sum, e) => sum + (e.unit ? 0 : e.quantity), 0);
  const cu = doc.customer;

  return (
    <Document title={`Delivery challan ${doc.orderNumber}`} author={co.name} subject={`Delivery challan for ${cu.name}`}>
      <Page size="A4" style={s.page}>
        <Header s={s} doc={doc} big title="DELIVERY CHALLAN" subtitle={subtitle} meta={meta} />
        <View style={s.body}>
          <View style={x.party} wrap={false}>
            <View style={x.partyBox}>
              <Text style={x.partyLabel}>FROM</Text>
              <Text style={x.partyName}>{co.name}</Text>
              {co.address ? <Text style={x.partyLine}>{co.address}</Text> : null}
              {co.phone ? <Text style={x.partyLine}>{co.phone}</Text> : null}
              {co.gstin ? <Text style={x.partyLine}>GSTIN {co.gstin}</Text> : null}
            </View>
            <View style={x.partyBox}>
              <Text style={x.partyLabel}>DELIVER TO</Text>
              <Text style={x.partyName}>{cu.name}</Text>
              {cu.address ? <Text style={x.partyLine}>{cu.address}</Text> : null}
              {cu.phone || cu.email ? <Text style={x.partyLine}>{[cu.phone, cu.email].filter(Boolean).join(" · ")}</Text> : null}
              {cu.gstin ? <Text style={x.partyLine}>GSTIN {cu.gstin}</Text> : null}
              {doc.venue ? <Text style={x.partyLine}>Venue: {doc.venue}</Text> : null}
            </View>
          </View>

          <View style={[s.strip, { paddingVertical: 8, marginTop: 10 }]} wrap={false}>
            <Text style={{ fontSize: 8.5 }}>
              <Text style={{ color: c.gold, fontWeight: 700 }}>{doc.entries.length}</Text> items · <Text style={{ color: c.gold, fontWeight: 700 }}>{pieces}</Text> pieces · prepared{" "}
              {longDate(doc.preparedOn)}
            </Text>
          </View>

          <View style={x.headRow} fixed>
            <Text style={[x.th, { width: 34, textAlign: "center" }]}>CHECK</Text>
            <Text style={[x.th, { width: 24 }]}>NO.</Text>
            <Text style={[x.th, { width: PHOTO + 10, textAlign: "center" }]}>PICTURE</Text>
            <Text style={[x.th, { flex: 1 }]}>ITEM</Text>
            <Text style={[x.th, { width: 64, textAlign: "right" }]}>QUANTITY</Text>
          </View>
          {doc.entries.length === 0 ? <Text style={[s.muted, { marginTop: 12 }]}>This order has no items.</Text> : null}
          {doc.entries.map((e, i) => {
            const picture = e.image ? (doc.images[e.image] ?? null) : null;
            return (
              <View style={x.row} key={`${e.name}-${i}`} wrap={false}>
                <View style={x.tick}>
                  <View style={x.box} />
                </View>
                <Text style={x.no}>{i + 1}</Text>
                <View style={x.photo}>
                  <View style={x.photoBox}>
                    {picture ? (
                      // eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt text
                      <Image src={picture} style={x.photoImg} />
                    ) : (
                      <Text style={[s.muted, { fontSize: 6.5 }]}>No picture</Text>
                    )}
                  </View>
                </View>
                <View style={x.item}>
                  <Text style={x.name}>{e.name}</Text>
                  {e.variant ? <Text style={x.chip}>{e.variant}</Text> : null}
                  {e.occasion ? <Text style={x.detail}>{e.occasion}</Text> : null}
                  {e.remark ? <Text style={x.remark}>{e.remark}</Text> : null}
                </View>
                <View style={x.qty}>
                  <Text style={x.qtyValue}>{e.quantity}</Text>
                  <Text style={x.qtyLabel}>{e.unit ?? (e.quantity === 1 ? "UNIT" : "UNITS")}</Text>
                </View>
              </View>
            );
          })}

          {/* Kept whole and never alone on a page: the signatures belong with the list they vouch for. */}
          <View style={x.sign} wrap={false} minPresenceAhead={120}>
            <View style={x.signBox}>
              <View style={x.signSpace} />
              <Text style={x.signWho}>For {co.name}</Text>
              <Text style={x.signLine}>Name:</Text>
              <Text style={x.signLine}>Date:</Text>
            </View>
            <View style={x.signBox}>
              <View style={x.signSpace} />
              <Text style={x.signWho}>Received by (client)</Text>
              <Text style={x.signLine}>Name:</Text>
              <Text style={x.signLine}>Date:</Text>
            </View>
          </View>
        </View>
        <Footer s={s} company={co} />
      </Page>
    </Document>
  );
}
