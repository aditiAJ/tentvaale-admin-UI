import { NextResponse } from "next/server";
import { validateProductImage, generateVariants } from "@/features/media-processing";

/**
 * Product image upload: validates and generates WebP variants here (sharp),
 * then forwards only an already-valid result to the Java backend to store.
 * A request that fails validation never reaches Java — it fails right here,
 * with the same per-file error shape the rest of the admin UI already expects
 * from the plain `/media/upload` endpoint (a `detail` string api-client.ts reads).
 *
 * This route is carved out of the blanket `/api/:path*` rewrite in
 * next.config.ts: a matching filesystem route (this file) is checked before
 * rewrites apply, so every other `/api/*` call keeps going through the rewrite
 * unchanged — see Next's rewrites.md, "applied after checking the filesystem".
 */
const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:8080";

function problem(status: number, detail: string) {
  return NextResponse.json({ detail }, { status });
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    // Real authorization (does this token have MASTER_DATA_WRITE) is still
    // Java's call at the forwarding step below — this is only a cheap gate so
    // an unauthenticated request can't make this route do real CPU work.
    return problem(401, "Not authenticated");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return problem(400, "Could not read the upload");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return problem(400, "No file was sent");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const validation = await validateProductImage(bytes);
  if (!validation.ok) {
    return problem(422, validation.error);
  }

  let variants;
  try {
    variants = await generateVariants(bytes, validation.width);
  } catch {
    return problem(500, "The image could not be processed");
  }

  const upstream = new FormData();
  upstream.set("width", String(validation.width));
  upstream.set("height", String(validation.height));
  for (const variant of variants) {
    upstream.set(
      `variant_${variant.size}`,
      new Blob([new Uint8Array(variant.buffer)], { type: "image/webp" }),
      `${variant.size}.webp`,
    );
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(`${apiOrigin}/api/admin/master-data/media/product-variants`, {
      method: "POST",
      headers: { Authorization: authorization },
      body: upstream,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return problem(502, "The server could not be reached");
  }

  const raw = await upstreamResponse.text();
  return new NextResponse(raw, {
    status: upstreamResponse.status,
    headers: { "content-type": upstreamResponse.headers.get("content-type") ?? "application/json" },
  });
}
