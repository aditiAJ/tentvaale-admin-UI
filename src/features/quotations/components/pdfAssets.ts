import QRCode from "qrcode";

/**
 * A picture from image storage. Asked of this app's own server first (which has no CORS rules to meet), then
 * straight from the storage as a fallback; null when neither works.
 */
async function fetchPicture(url: string): Promise<Response | null> {
  try {
    const viaServer = await fetch(`/pdf-image?url=${encodeURIComponent(url)}`);
    if (viaServer.ok) return viaServer;
  } catch {
    // Fall through to the direct request.
  }
  try {
    const direct = await fetch(url);
    return direct.ok ? direct : null;
  } catch {
    return null;
  }
}

/**
 * A picture as a data URL for the PDF, shrunk to at most `maxSide` pixels and saved as JPEG so a document with many
 * pictures stays small. Null when it cannot be fetched (a storage bucket that does not allow this site to read it,
 * a deleted file) or is not a picture: the document then leaves the picture out rather than fail.
 */
export async function loadImageData(url: string | null | undefined, maxSide = 480): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetchPicture(url);
    if (!response) return null;
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    // A transparent picture (a logo, a product cut-out) sits on white, as it will on the page.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}

/** A logo or signature: kept as PNG so its transparency survives. Same fallback as above. */
export async function loadMarkData(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetchPicture(url);
    if (!response) return null;
    const blob = await response.blob();
    if (!/^image\/(png|jpe?g)$/.test(blob.type)) return loadImageData(url, 400);
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const qr = (text: string) => QRCode.toDataURL(text, { margin: 1, width: 240 });

/** The QR codes the document prints: pay by UPI, and chat on WhatsApp. Each is null when its detail is missing. */
export async function loadQrCodes(
  company: { name: string; upiId: string | null; phone: string | null },
): Promise<{ upi: string | null; whatsapp: string | null }> {
  const digits = (company.phone ?? "").replace(/\D/g, "");
  const whatsapp = digits.length >= 10 ? (digits.length === 10 ? `91${digits}` : digits) : null;
  return {
    upi: company.upiId ? await qr(`upi://pay?pa=${encodeURIComponent(company.upiId)}&pn=${encodeURIComponent(company.name)}&cu=INR`) : null,
    whatsapp: whatsapp ? await qr(`https://wa.me/${whatsapp}`) : null,
  };
}
