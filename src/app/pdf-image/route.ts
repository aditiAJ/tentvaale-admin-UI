import { NextResponse } from "next/server";

/**
 * Fetches a picture for the quotation PDF on the server, where the image storage's missing CORS headers do not
 * matter, and hands it to the browser from this app's own address. Only https pictures from the hosts named in
 * PDF_IMAGE_HOSTS (comma separated; default: any *.r2.dev) are fetched, so this cannot be used to reach anything else.
 */
const MAX_BYTES = 6 * 1024 * 1024;

function allowed(host: string): boolean {
  const configured = (process.env.PDF_IMAGE_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const name = host.toLowerCase();
  if (configured.length > 0) return configured.some((h) => name === h || name.endsWith(`.${h}`));
  return name.endsWith(".r2.dev");
}

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("url");
  let url: URL;
  try {
    url = new URL(target ?? "");
  } catch {
    return new NextResponse("Bad address", { status: 400 });
  }
  if (url.protocol !== "https:" || !allowed(url.hostname)) {
    return new NextResponse("That picture cannot be fetched", { status: 403 });
  }
  try {
    const upstream = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(10_000) });
    const type = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || !type.startsWith("image/")) return new NextResponse("Not a picture", { status: 404 });
    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return new NextResponse("Too large", { status: 413 });
    return new NextResponse(body, { headers: { "content-type": type, "cache-control": "private, max-age=3600" } });
  } catch {
    return new NextResponse("Could not fetch", { status: 502 });
  }
}
