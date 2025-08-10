import { NextResponse } from "next/server";

// Very small HTML meta extractor without external deps
function extractMeta(html: string, name: string): string | null {
  const propRe = new RegExp(
    `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const m = html.match(propRe);
  return m ? decodeHtml(m[1]) : null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeHtml(m[1].trim()) : null;
}

function extractFavicon(html: string, baseUrl: URL): string | null {
  const linkRe = /<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]*>/gi;
  const hrefRe = /href=["']([^"']+)["']/i;
  const candidates: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html))) {
    const tag = m[0];
    const hrefM = tag.match(hrefRe);
    if (hrefM) candidates.push(hrefM[1]);
  }
  const href = candidates[0] || "/favicon.ico";
  try {
    const url = new URL(href, baseUrl);
    return url.toString();
  } catch {
    return null;
  }
}

function decodeHtml(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function isHttpUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUrl = searchParams.get("url");
    if (!rawUrl || !isHttpUrl(rawUrl)) {
      return NextResponse.json({ ok: false, error: "Invalid URL" }, { status: 400 });
    }

    const target = new URL(rawUrl);
    // Basic safety: disallow localhost/private networks by hostname heuristic
    const forbiddenHosts = [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "::1",
    ];
    if (forbiddenHosts.includes(target.hostname)) {
      return NextResponse.json({ ok: false, error: "Forbidden host" }, { status: 400 });
    }

    const res = await fetch(target.toString(), {
      // Try to get HTML with a desktop UA; many sites gate by UA
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/*;q=0.8,*/*;q=0.7",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") || "";
    const ok = res.ok;

    // If non-HTML (e.g., image), just return minimal info
    if (!/text\/html/i.test(contentType)) {
      return NextResponse.json({
        ok,
        url: target.toString(),
        contentType,
        siteName: target.hostname,
        title: target.toString(),
      });
    }

    const html = await res.text();

    const siteName =
      extractMeta(html, "og:site_name") || target.hostname.replace(/^www\./, "");
    const title =
      extractMeta(html, "og:title") || extractTitle(html) || target.toString();
    const description =
      extractMeta(html, "og:description") ||
      extractMeta(html, "description") ||
      null;
    const imageRel = extractMeta(html, "og:image") || null;
    const image = imageRel
      ? (() => {
          try {
            return new URL(imageRel, target).toString();
          } catch {
            return null;
          }
        })()
      : null;
    const favicon = extractFavicon(html, target);

    return NextResponse.json({
      ok,
      url: target.toString(),
      siteName,
      title,
      description,
      image,
      favicon,
      contentType,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to fetch preview" },
      { status: 500 },
    );
  }
}


